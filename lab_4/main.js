import http from 'http';
import fs from 'fs';
import { Command } from 'commander';

const program = new Command();

// Налаштування параметрів командного рядка
program
    .requiredOption('-i, --input <path>', 'шлях до файлу даних')
    .requiredOption('-h, --host <address>', 'адреса сервера')
    .requiredOption('-p, --port <number>', 'порт сервера')
    .option('-o, --output <path>', 'файл, у який записується остання надіслана відповідь')
    .helpOption('-?, --help', 'вивести довідку');

program.parse(process.argv);
const options = program.opts();

// 1. Асинхронна перевірка наявності файлу (лише колбек)
fs.access(options.input, fs.constants.F_OK, (err) => {
    if (err) {
        console.error('Cannot find input file');
        process.exit(1);
    }

    // 2. Створення HTTP сервера
    const server = http.createServer((req, res) => {
        const parsedUrl = new URL(req.url, `http://${options.host}:${options.port}`);

        // Перевірка маршруту (дозволено тільки /)
        if (parsedUrl.pathname !== '/') {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Маршрут не знайдено. Дозволено лише /' }));
            return;
        }

        // 3. Асинхронне читання файлу (лише колбек)
        fs.readFile(options.input, 'utf8', (readErr, data) => {
            if (readErr) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Помилка читання файлу' }));
                return;
            }

            let bookings;
            try {
                bookings = JSON.parse(data);
            } catch (parseErr) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Файл не є коректним JSON-масивом' }));
                return;
            }

            // Зчитування параметрів рядка запиту
            const paymentParam = parsedUrl.searchParams.get('payment');
            const minValueParam = parsedUrl.searchParams.get('min_value');

            const showPayment = paymentParam === 'true';
            let minValue = null;

            // Перевірка числового параметра min_value
            if (minValueParam !== null) {
                minValue = Number(minValueParam);
                if (Number.isNaN(minValue)) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Параметр min_value має бути числом' }));
                    return;
                }
            }

            // 4. Фільтрація і формування вихідного JSON (Варіант 8 - Bookings)
            const result = [];
            for (let i = 0; i < bookings.length; i++) {
                const b = bookings[i];

                // Перетворюємо Booking_Value на число
                const bookingValueStr = b.Booking_Value;
                const bookingValue = (bookingValueStr === 'null' || !bookingValueStr) ? 0 : Number(bookingValueStr);

                // Фільтр: лише бронювання з Booking_Value БІЛЬШИМ за min_value
                if (minValue !== null && bookingValue <= minValue) {
                    continue;
                }

                // Формуємо об'єкт із правильними полями
                const outputObj = {
                    booking_id: b.Booking_ID,
                    vehicle_type: b.Vehicle_Type,
                    booking_value: bookingValue
                };

                // Додаємо payment_method, якщо увімкнено прапорець
                if (showPayment) {
                    const method = b.Payment_Method;
                    // Згідно з прикладом, якщо 'null', повертаємо порожній рядок ""
                    outputObj.payment_method = (method === 'null' || !method) ? "" : method;
                }

                result.push(outputObj);
            }

            const responseJson = JSON.stringify(result, null, 2);

            // 5. Запис у файл, якщо задано опцію --output
            if (options.output) {
                fs.writeFile(options.output, responseJson, 'utf8', (writeErr) => {
                    if (writeErr) {
                        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ error: 'Помилка запису у файл output' }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(responseJson);
                });
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(responseJson);
            }
        });
    });

    server.listen(options.port, options.host, () => {
        console.log(`Сервер працює на http://${options.host}:${options.port}`);
    });
});