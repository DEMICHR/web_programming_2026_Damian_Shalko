import fs from 'fs';
import { Command } from 'commander';

const program = new Command();

// Опис програми
program
    .name('weather-station')
    .description('CLI-програма для аналізу даних метеостанції (Варіант 6)')
    .version('1.0.0');

// Глобальна опція для вказання шляху до файлу
program
    .option('-f, --file <path>', 'шлях до JSON-файлу', 'data.json');

// Функція для безпечного читання файлу
function loadData(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.error(`❌ Помилка: Не вдалося прочитати файл "${filePath}".`, error.message);
        process.exit(1);
    }
}

// ==========================================
// ЧАСТИНА 3: ЗАГАЛЬНІ МОЖЛИВОСТІ
// ==========================================

// 1. list: Перелік сенсорів
program
    .command('list')
    .description('Показати перелік сенсорів метеостанції')
    .option('-l, --limit <number>', 'обмежити кількість виведених елементів')
    .action((options) => {
        const data = loadData(program.opts().file);
        let items = data.sensors || [];

        if (options.limit) {
            items = items.slice(0, parseInt(options.limit, 10));
        }

        console.log(`📡 Станція: ${data.stationId} (Дата: ${data.date})`);
        items.forEach(item => {
            const status = item.isActive ? '🟢 Активний' : '🔴 Вимкнений';
            console.log(`- [${item.sensorId}] Тип: ${item.type} | ${status}`);
        });
    });

// 2. info: Інформація про конкретний елемент
program
    .command('info <sensorId>')
    .description('Показати всі дані (JSON) про конкретний сенсор')
    .action((sensorId) => {
        const data = loadData(program.opts().file);
        const item = data.sensors.find(el => el.sensorId.toUpperCase() === sensorId.toUpperCase());

        if (!item) {
            console.error(`❌ Помилка: Сенсор "${sensorId}" не знайдено.`);
            process.exit(1);
        }
        console.log(item);
    });

// 3. field: Значення окремого поля сенсора
program
    .command('field <sensorId> <fieldName>')
    .description('Показати значення конкретного поля (наприклад, type або isActive)')
    .action((sensorId, fieldName) => {
        const data = loadData(program.opts().file);
        const item = data.sensors.find(el => el.sensorId.toUpperCase() === sensorId.toUpperCase());

        if (!item) {
            console.error(`❌ Помилка: Сенсор "${sensorId}" не знайдено.`);
            process.exit(1);
        }
        if (!(fieldName in item)) {
            console.error(`❌ Помилка: Поле "${fieldName}" відсутнє у сенсора.`);
            process.exit(1);
        }

        console.log(`${fieldName}: ${item[fieldName]}`);
    });

// ==========================================
// ЧАСТИНА 4: МОЖЛИВОСТІ ВАРІАНТА №6
// ==========================================

// 1. Характеристика обраного датчика
program
    .command('sensor-info <sensorId>')
    .description('Вивести відформатовану характеристику обраного датчика')
    .action((sensorId) => {
        const data = loadData(program.opts().file);
        const sensor = data.sensors.find(s => s.sensorId.toUpperCase() === sensorId.toUpperCase());

        if (!sensor) {
            console.error(`❌ Помилка: Датчик "${sensorId}" не знайдено.`);
            process.exit(1);
        }

        console.log(`📊 Характеристика датчика [${sensor.sensorId}]:`);
        console.log(`- Тип: ${sensor.type}`);
        console.log(`- Одиниці виміру: ${sensor.unit}`);
        console.log(`- Стан: ${sensor.isActive ? 'Активний' : 'Неактивний'}`);
        console.log(`- Кількість записів показів: ${sensor.readings ? sensor.readings.length : 0}`);
    });

// 2. Серія показів з можливістю пропускати відсутні
program
    .command('readings <sensorId>')
    .description('Показати серію показів датчика')
    .option('-s, --skip-missing', 'пропустити відсутні (null) покази')
    .action((sensorId, options) => {
        const data = loadData(program.opts().file);
        const sensor = data.sensors.find(s => s.sensorId.toUpperCase() === sensorId.toUpperCase());

        if (!sensor) {
            console.error(`❌ Помилка: Датчик "${sensorId}" не знайдено.`);
            process.exit(1);
        }

        let readings = sensor.readings || [];

        // Якщо передано прапорець -s, фільтруємо значення, відкидаючи null
        if (options.skipMissing) {
            readings = readings.filter(r => r.value !== null);
        }

        console.log(`📈 Покази датчика [${sensor.sensorId}]:`);
        if (readings.length === 0) {
            console.log(' (Немає показів для відображення)');
        } else {
            readings.forEach(r => {
                const val = r.value !== null ? `${r.value} ${sensor.unit}` : 'Відсутньо (null)';
                console.log(`- Час: ${r.time} | Значення: ${val}`);
            });
        }
    });

// 3. Мінімум, максимум і середнє без урахування відсутніх показів
program
    .command('stats <sensorId>')
    .description('Обчислити мінімум, максимум і середнє значення показів датчика')
    .action((sensorId) => {
        const data = loadData(program.opts().file);
        const sensor = data.sensors.find(s => s.sensorId.toUpperCase() === sensorId.toUpperCase());

        if (!sensor) {
            console.error(`❌ Помилка: Датчик "${sensorId}" не знайдено.`);
            process.exit(1);
        }

        // Відфільтровуємо лише валідні числа, відкидаючи null
        const validReadings = (sensor.readings || []).filter(r => r.value !== null && typeof r.value === 'number');

        if (validReadings.length === 0) {
            console.log(`⚠️ Для датчика [${sensor.sensorId}] немає числових показів для обчислення статистики.`);
            return;
        }

        let min = validReadings[0].value;
        let max = validReadings[0].value;
        let sum = 0;

        // Цикл для знаходження мінімуму, максимуму та суми
        validReadings.forEach(r => {
            if (r.value < min) min = r.value;
            if (r.value > max) max = r.value;
            sum += r.value;
        });

        const avg = (sum / validReadings.length).toFixed(2);

        console.log(`📊 Статистика датчика [${sensor.sensorId}] (розраховано за ${validReadings.length} показами):`);
        console.log(`- Мінімум: ${min} ${sensor.unit}`);
        console.log(`- Максимум: ${max} ${sensor.unit}`);
        console.log(`- Середнє: ${avg} ${sensor.unit}`);
    });

// Запуск парсера
program.parse(process.argv);