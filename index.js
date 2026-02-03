const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const schedule = require('./schedule.json');

// Функция для определения четности недели в учебном году
function isEvenWeek(date = new Date()) {
    // 1 сентября - начало учебного года (можно изменить на нужную дату)
    const academicYearStart = new Date(date.getFullYear(), 8, 1); // 1 сентября текущего года
    
    // Если текущая дата до 1 сентября, берем начало прошлого учебного года
    if (date < academicYearStart) {
        academicYearStart.setFullYear(date.getFullYear() - 1);
    }
    
    // Вычисляем количество прошедших недель с начала учебного года
    const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksPassed = Math.floor((date - academicYearStart) / millisecondsPerWeek);
    
    // ВОТ ИЗМЕНЕНИЕ: Меняем четность на противоположную
    // Если weeksPassed четное - возвращаем false (нечетная неделя)
    // Если weeksPassed нечетное - возвращаем true (четная неделя)
    return weeksPassed % 2 === 1; // Было: weeksPassed % 2 === 0
}

// Получить тип недели (четная/нечетная)
function getWeekType(date = new Date()) {
    return isEvenWeek(date) ? 'четная' : 'нечетная';
}

// Инвертировать четность недели (второй вариант исправления)
function getCorrectedWeekType(date = new Date()) {
    return isEvenWeek(date) ? 'нечетная' : 'четная';
}

// Эмодзи для типов занятий
function getTypeEmoji(type) {
    const emojis = {
        'лекция': '📖',
        'практика': '✏️',
        'лабораторная': '🔬',
        'семинар': '💬'
    };
    return emojis[type.toLowerCase()] || '📚';
}

// Функция для получения расписания по дню
function getScheduleForDay(day, showWeek = true, targetDate = new Date()) {
    day = day.toLowerCase().trim();
    
    // Короткие команды
    const dayAliases = {
        'пн': 'понедельник',
        'вт': 'вторник',
        'ср': 'среда',
        'чт': 'четверг',
        'пт': 'пятница',
        'сб': 'суббота',
        'вс': 'воскресенье'
    };
    
    if (dayAliases[day]) {
        day = dayAliases[day];
    }
    
    if (schedule[day]) {
        // ИСПРАВЛЕНО: Используем исправленный тип недели
        const currentWeekType = getCorrectedWeekType(targetDate);
        const allClasses = schedule[day];
        
        // Фильтруем пары по текущей неделе
        const classes = allClasses.filter(cls => {
            return cls.weeks === 'все' || cls.weeks === currentWeekType;
        });
        
        if (classes.length === 0) {
            return `📅 *${day.charAt(0).toUpperCase() + day.slice(1)}*: выходной день 🎉`;
        }
        
        let response = `📅 *Расписание на ${day}*\n`;
        if (showWeek) {
            response += `📆 Неделя: *${currentWeekType.toUpperCase()}*\n`;
        }
        response += '\n';
        
        classes.forEach((cls, index) => {
            const typeEmoji = getTypeEmoji(cls.type);
            response += `${index + 1}. ⏰ *${cls.time}* - ${cls.subject}\n`;
            response += `   ${typeEmoji} ${cls.type.charAt(0).toUpperCase() + cls.type.slice(1)}\n`;
            response += `   📍 Аудитория: ${cls.room}\n`;
            response += `   👨‍🏫 ${cls.teacher}\n`;
            
            // Показываем если пара только на определенной неделе
            if (cls.weeks !== 'все') {
                response += `   📌 Только ${cls.weeks} неделя\n`;
            }
            response += '\n';
        });
        
        return response;
    }
    return null;
}

// Получить расписание на сегодня
function getTodaySchedule() {
    const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const today = days[new Date().getDay()];
    return getScheduleForDay(today, true, new Date());
}

// Получить расписание на завтра
function getTomorrowSchedule() {
    const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = days[tomorrow.getDay()];
    return getScheduleForDay(tomorrowDay, true, tomorrow);
}

// Получить расписание на всю неделю
function getWeekSchedule(weekType = null) {
    const currentDate = new Date();
    // ИСПРАВЛЕНО: Используем исправленный тип недели
    const currentWeekType = weekType || getCorrectedWeekType(currentDate);
    
    let response = `📚 *Расписание на неделю*\n`;
    response += `📆 Неделя: *${currentWeekType.toUpperCase()}*\n\n`;
    
    const weekDays = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница'];
    
    weekDays.forEach(day => {
        const allClasses = schedule[day] || [];
        const classes = allClasses.filter(cls => {
            return cls.weeks === 'все' || cls.weeks === currentWeekType;
        });
        
        response += `▪️ *${day.toUpperCase()}*\n`;
        if (classes && classes.length > 0) {
            classes.forEach(cls => {
                const typeEmoji = getTypeEmoji(cls.type);
                response += `  ${cls.time} ${typeEmoji} ${cls.subject}`;
                if (cls.weeks !== 'все') {
                    response += ` [${cls.weeks}]`;
                }
                response += ` (ауд. ${cls.room})\n`;
            });
        } else {
            response += '  Выходной\n';
        }
        response += '\n';
    });
    
    return response;
}

// Получить расписание для четной/нечетной недели
function getScheduleByWeekType(type) {
    if (type !== 'четная' && type !== 'нечетная') {
        return null;
    }
    
    let response = `📚 *Расписание на ${type} неделю*\n\n`;
    
    const weekDays = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница'];
    
    weekDays.forEach(day => {
        const allClasses = schedule[day] || [];
        const classes = allClasses.filter(cls => {
            return cls.weeks === 'все' || cls.weeks === type;
        });
        
        response += `▪️ *${day.toUpperCase()}*\n`;
        if (classes && classes.length > 0) {
            classes.forEach(cls => {
                const typeEmoji = getTypeEmoji(cls.type);
                response += `  ${cls.time} ${typeEmoji} ${cls.subject}`;
                if (cls.weeks !== 'все') {
                    response += ` [${cls.weeks}]`;
                }
                response += ` (ауд. ${cls.room})\n`;
            });
        } else {
            response += '  Нет пар\n';
        }
        response += '\n';
    });
    
    return response;
}

// Справка
function getHelpMessage() {
    const currentWeekType = getCorrectedWeekType();
    
    return `🤖 *Бот расписания пар*

📆 Текущая неделя: *${currentWeekType.toUpperCase()}*

*📋 Основные команды:*
• сегодня / today - расписание на сегодня
• завтра / tomorrow - расписание на завтра
• расписание / неделя - расписание на текущую неделю
• пн, вт, ср, чт, пт - расписание на конкретный день
• понедельник, вторник и т.д. - полное название дня

*📅 По неделям:*
• четная - расписание на четную неделю
• нечетная - расписание на нечетную неделю

*ℹ️ Обозначения:*
📖 - Лекция
✏️ - Практика
🔬 - Лабораторная работа

Просто напишите команду в группу! 📱`;
}

// Основная функция бота
async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        
        // Получаем последнюю версию Baileys
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`Используется WA версия v${version.join('.')}, последняя: ${isLatest}`);
        
        const sock = makeWASocket({
            version,
            logger: P({ level: 'silent' }),
            auth: state,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
            markOnlineOnConnect: true,
            browser: ['Schedule Bot', 'Chrome', '10.0'],
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('\n📱 Отсканируйте QR-код в WhatsApp:\n');
                qrcode.generate(qr, { small: true });
                console.log('\n✅ Как подключить:');
                console.log('1. Откройте WhatsApp на телефоне');
                console.log('2. Нажмите на три точки (⋮) → Связанные устройства');
                console.log('3. Нажмите "Привязать устройство"');
                console.log('4. Отсканируйте QR-код выше\n');
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log('\n❌ Соединение закрыто');
                console.log('Код ошибки:', statusCode);
                
                if (statusCode === 405) {
                    console.log('⚠️  Ошибка 405: Используйте VPN или мобильный интернет');
                }
                
                if (shouldReconnect) {
                    console.log('Переподключение через 10 секунд...\n');
                    setTimeout(() => startBot(), 10000);
                }
            } else if (connection === 'open') {
                const weekType = getCorrectedWeekType();
                console.log('\n✅ БОТ УСПЕШНО ПОДКЛЮЧЕН К WHATSAPP!');
                console.log(`📆 Текущая неделя: ${weekType.toUpperCase()}`);
                console.log('📚 Бот готов отвечать на команды в группах!\n');
            } else if (connection === 'connecting') {
                console.log('🔄 Подключение к WhatsApp...');
            }
        });
        
        // Обработка сообщений
        sock.ev.on('messages.upsert', async (m) => {
            try {
                const msg = m.messages[0];
                
                if (!msg.message || msg.key.fromMe) return;
                
                const messageText = msg.message.conversation || 
                                  msg.message.extendedTextMessage?.text || '';
                
                const command = messageText.toLowerCase().trim();
                const chatId = msg.key.remoteJid;
                
                let response = null;
                
                // Обработка команд
                if (['помощь', 'help', 'start', 'bot', 'бот', 'команды'].includes(command)) {
                    response = getHelpMessage();
                }
                else if (['сегодня', 'today'].includes(command)) {
                    response = getTodaySchedule();
                }
                else if (['завтра', 'tomorrow'].includes(command)) {
                    response = getTomorrowSchedule();
                }
                else if (['расписание', 'неделя', 'week', 'все'].includes(command)) {
                    response = getWeekSchedule();
                }
                else if (command === 'четная' || command === 'четная неделя') {
                    response = getScheduleByWeekType('четная');
                }
                else if (command === 'нечетная' || command === 'нечетная неделя') {
                    response = getScheduleByWeekType('нечетная');
                }
                else if (command === 'какая неделя' || command === 'неделя?') {
                    const weekType = getCorrectedWeekType();
                    response = `📆 Сейчас *${weekType.toUpperCase()}* неделя`;
                }
                else {
                    // Проверяем, не день недели ли это
                    const daySchedule = getScheduleForDay(command);
                    if (daySchedule) {
                        response = daySchedule;
                    }
                }
                
                // Отправляем ответ
                if (response) {
                    console.log(`📩 Команда "${command}" от ${chatId.split('@')[0]}`);
                    await sock.sendMessage(chatId, { text: response });
                    console.log('✅ Ответ отправлен');
                }
            } catch (error) {
                console.error('Ошибка обработки сообщения:', error.message);
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка запуска бота:', error.message);
        console.log('Переподключение через 10 секунд...');
        setTimeout(() => startBot(), 10000);
    }
}

// Запуск бота
console.log('🚀 Запуск бота расписания...\n');
console.log('✅ Режим исправления недели активирован (инвертировано)');
startBot();