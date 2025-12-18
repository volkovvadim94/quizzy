import pkg from '@prisma/client'
const { PrismaClient } = pkg
const prisma = new PrismaClient();

async function seedDatabase() {
  try {
    console.log('Начинаем заполнение базы данных...');

    // 1. Создаем темы (topics)
    const topicsData = [
      { name: 'Тест', slug: 'default' },
      { name: 'Общее', slug: 'general' },
      { name: 'Автомобили', slug: 'cars' },
      { name: 'История', slug: 'history' },
      { name: 'Искусство', slug: 'art' },
      { name: 'Игры', slug: 'games' },
      { name: 'Фильмы и сериалы', slug: 'movies-tv' },
      { name: 'Животные', slug: 'animals' },
      { name: 'Еда', slug: 'food' },
      { name: 'География', slug: 'geography' },
      { name: 'Литература', slug: 'literature' },
      { name: 'Музыка', slug: 'music' },
      { name: 'Наука', slug: 'science' },
    ];

    console.log('Создаем темы...');
    const createdTopics = [];

    for (const topicData of topicsData) {
      const topic = await prisma.topic.upsert({
        where: { slug: topicData.slug },
        update: {},
        create: topicData,
      });
      createdTopics.push(topic);
      console.log(`Создана тема: ${topic.name} (ID: ${topic.id})`);
    }

    // 2. Создаем вопросы для каждой темы (по 20 вопросов на тему)
    const questionsData = [
      {
        topicSlug: 'default',
        questions: [
          {
            text: "Тестовый вопрос 1",
            options: JSON.stringify(["Правильный", "Неправильный", "Неправильный", "Неправильный"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          }]
      },
      {
        topicSlug: 'default',
        questions: [
          {
            text: "Тестовый вопрос 2",
            options: JSON.stringify(["Правильный", "Неправильный", "Неправильный", "Неправильный"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          }]
      },
      {
        topicSlug: 'default',
        questions: [
          {
            text: "Тестовый вопрос 3",
            options: JSON.stringify(["Правильный", "Неправильный", "Неправильный", "Неправильный"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          }]
      },
      {
        topicSlug: 'default',
        questions: [
          {
            text: "Тестовый вопрос 4",
            options: JSON.stringify(["Правильный", "Неправильный", "Неправильный", "Неправильный"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          }]
      },
      {
        topicSlug: 'default',
        questions: [
          {
            text: "Тестовый вопрос 5",
            options: JSON.stringify(["Правильный", "Неправильный", "Неправильный", "Неправильный"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          }]
      },
      // Общее (general) - 20 вопросов
      {
        topicSlug: 'general',
        questions: [
          // single_choice вопросы
          {
            text: "Сколько континентов на планете Земля?",
            options: JSON.stringify(["4", "6", "7", "8"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой элемент имеет химический символ 'O'?",
            options: JSON.stringify(["Осмий", "Олово", "Кислород", "Золото"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какая планета самая большая в Солнечной системе?",
            options: JSON.stringify(["Земля", "Юпитер", "Сатурн", "Марс"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Сколько дней в високосном году?",
            options: JSON.stringify(["365", "366", "364", "367"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой газ преобладает в атмосфере Земли?",
            options: JSON.stringify(["Кислород", "Углекислый газ", "Азот", "Водород"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Сколько костей в теле взрослого человека?",
            options: JSON.stringify(["206", "196", "216", "226"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какое животное является символом США?",
            options: JSON.stringify(["Медведь", "Орёл", "Бизон", "Волк"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой океан самый большой?",
            options: JSON.stringify(["Атлантический", "Индийский", "Тихий", "Северный Ледовитый"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Сколько цветов у радуги?",
            options: JSON.stringify(["5", "6", "7", "8"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какое самое твердое природное вещество?",
            options: JSON.stringify(["Сталь", "Алмаз", "Кварц", "Корунд"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Как называется наука о грибах?",
            options: JSON.stringify(["Ботаника", "Микология", "Зоология", "Энтомология"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Сколько лет длилась Столетняя война?",
            options: JSON.stringify(["100", "116", "96", "106"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какая страна имеет форму сапога?",
            options: JSON.stringify(["Испания", "Италия", "Греция", "Франция"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          // sequence вопросы (3 штуки)
          {
            text: "Расположите эти единицы информации по возрастанию",
            options: JSON.stringify(["Гигабайт", "Мегабайт", "Байт", "Терабайт"]),
            correctSequence: JSON.stringify([2, 1, 0, 3]),
            type: "sequence",
            difficultyPreset: 1
          },
          {
            text: "Расставьте этапы развития человека по хронологии",
            options: JSON.stringify(["Неандерталец", "Кроманьонец", "Австралопитек", "Человек разумный"]),
            correctSequence: JSON.stringify([2, 0, 1, 3]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расположите планеты по удаленности от Солнца (от ближайшей)",
            options: JSON.stringify(["Земля", "Венера", "Марс", "Меркурий"]),
            correctSequence: JSON.stringify([3, 1, 0, 2]),
            type: "sequence",
            difficultyPreset: 2
          },
          // Еще single_choice для общего
          {
            text: "Кто изобрел телефон?",
            options: JSON.stringify(["Томас Эдисон", "Александр Белл", "Никола Тесла", "Гульельмо Маркони"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой химический элемент обозначается как 'Au'?",
            options: JSON.stringify(["Серебро", "Золото", "Алюминий", "Медь"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Сколько клавиш у стандартного пианино?",
            options: JSON.stringify(["76", "88", "92", "96"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какой город является столицей Австралии?",
            options: JSON.stringify(["Сидней", "Мельбурн", "Канберра", "Брисбен"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 2
          }
        ]
      },
      // Автомобили (cars) - 20 вопросов
      {
        topicSlug: 'cars',
        questions: [
          {
            text: "Какая страна является родиной марки Ferrari?",
            options: JSON.stringify(["Германия", "Италия", "Япония", "США"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой тип двигателя является электродвигателем?",
            options: JSON.stringify(["Дизельный", "Роторный", "Бензиновый", "Электрический"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какая марка автомобиля имеет эмблему в виде четырех колец?",
            options: JSON.stringify(["BMW", "Mercedes", "Audi", "Volvo"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Как называется система полного привода у Subaru?",
            options: JSON.stringify(["4Matic", "xDrive", "Symmetrical AWD", "Quattro"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой автомобиль считается первым серийным в мире?",
            options: JSON.stringify(["Ford Model T", "Benz Patent-Motorwagen", "Oldsmobile Curved Dash", "Daimler Motor Carriage"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Что означает аббревиатура SUV?",
            options: JSON.stringify(["Sport Utility Vehicle", "Special Urban Vehicle", "Super Utility Vehicle", "Standard Urban Vehicle"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой автомобиль прозвали 'Быком'?",
            options: JSON.stringify(["Ferrari F40", "Lamborghini Miura", "Porsche 911", "Chevrolet Corvette"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Кто основал компанию Toyota?",
            options: JSON.stringify(["Соинчиро Хонда", "Киичиро Тойода", "Эйдзи Тойода", "Сакичи Тойода"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какой двигатель устанавливался на Volkswagen Beetle?",
            options: JSON.stringify(["Боксер-оппозитный", "V-образный", "Рядный", "Роторный"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Что означает 'GT' в названиях автомобилей?",
            options: JSON.stringify(["Grand Touring", "German Technology", "Great Transport", "Gas Turbo"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой автомобиль стал первым, превысившим скорость 400 км/ч?",
            options: JSON.stringify(["Bugatti Veyron", "Koenigsegg Agera", "McLaren F1", "SSC Ultimate Aero"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какая система безопасности была впервые представлена Mercedes-Benz в 1978?",
            options: JSON.stringify(["ABS", "ESP", "Подушка безопасности", "Ремни безопасности"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какой автомобиль называют 'Ежом'?",
            options: JSON.stringify(["Fiat 500", "Smart Fortwo", "Mini Cooper", "Citroen 2CV"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          // sequence вопросы для автомобилей
          {
            text: "Расположите эти автомобильные бренды по году основания (от самого старого)",
            options: JSON.stringify(["Toyota", "Mercedes-Benz", "BMW", "Ford"]),
            correctSequence: JSON.stringify([3, 1, 2, 0]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расставьте эти модели Ferrari по году выпуска (от самой старой)",
            options: JSON.stringify(["F40", "Testarossa", "Enzo", "LaFerrari"]),
            correctSequence: JSON.stringify([1, 0, 2, 3]),
            type: "sequence",
            difficultyPreset: 3
          },
          {
            text: "Расположите эти типы кузовов по вместимости (от наименьшей)",
            options: JSON.stringify(["Седан", "Купе", "Минивэн", "Хэтчбек"]),
            correctSequence: JSON.stringify([1, 0, 3, 2]),
            type: "sequence",
            difficultyPreset: 1
          },
          // Еще single_choice для автомобилей
          {
            text: "Какой гибридный автомобиль стал первым массовым?",
            options: JSON.stringify(["Toyota Prius", "Honda Insight", "Chevrolet Volt", "Tesla Model S"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Что означает 'M' в аббревиатуре BMW M3?",
            options: JSON.stringify(["Motorsport", "Modern", "Maximum", "Master"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой автомобиль является самым продаваемым в истории?",
            options: JSON.stringify(["Volkswagen Golf", "Toyota Corolla", "Ford F-Series", "Honda Civic"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Что такое 'карбюратор'?",
            options: JSON.stringify(["Тормозная система", "Система зажигания", "Система подачи топлива", "Система охлаждения"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 2
          }
        ]
      },
      // История (history) - 20 вопросов
      {
        topicSlug: 'history',
        questions: [
          {
            text: "В каком году началась Вторая мировая война?",
            options: JSON.stringify(["1914", "1939", "1941", "1945"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто был первым президентом США?",
            options: JSON.stringify(["Авраам Линкольн", "Томас Джефферсон", "Джордж Вашингтон", "Бенджамин Франклин"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "В каком году человек впервые полетел в космос?",
            options: JSON.stringify(["1957", "1961", "1969", "1975"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто открыл Америку в 1492 году?",
            options: JSON.stringify(["Васко да Гама", "Христофор Колумб", "Фернан Магеллан", "Америго Веспуччи"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "В каком году распался Советский Союз?",
            options: JSON.stringify(["1989", "1990", "1991", "1992"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто был последним российским императором?",
            options: JSON.stringify(["Александр II", "Александр III", "Николай I", "Николай II"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "В каком году произошла Великая французская революция?",
            options: JSON.stringify(["1776", "1789", "1799", "1812"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Кто написал 'Капитал'?",
            options: JSON.stringify(["Фридрих Энгельс", "Карл Маркс", "Владимир Ленин", "Адам Смит"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой город был столицей Византийской империи?",
            options: JSON.stringify(["Рим", "Константинополь", "Афины", "Александрия"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Кто был первым человеком, ступившим на Луну?",
            options: JSON.stringify(["Юрий Гагарин", "Нил Армстронг", "Базз Олдрин", "Алексей Леонов"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "В каком году была подписана Magna Carta?",
            options: JSON.stringify(["1066", "1215", "1453", "1492"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Кто был первым римским императором?",
            options: JSON.stringify(["Юлий Цезарь", "Октавиан Август", "Нерон", "Константин"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой договор завершил Первую мировую войну?",
            options: JSON.stringify(["Версальский", "Брестский", "Потсдамский", "Ялтинский"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          // sequence вопросы для истории
          {
            text: "Расположите эти события в хронологическом порядке",
            options: JSON.stringify(["Падение Берлинской стены", "Первая мировая война", "Распад СССР", "Вторая мировая война"]),
            correctSequence: JSON.stringify([1, 3, 0, 2]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расставьте этих правителей России по хронологии правления",
            options: JSON.stringify(["Петр I", "Иван Грозный", "Екатерина II", "Александр I"]),
            correctSequence: JSON.stringify([1, 0, 2, 3]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расположите эти цивилизации по времени возникновения (от самой древней)",
            options: JSON.stringify(["Древний Рим", "Древний Египет", "Древняя Греция", "Месопотамия"]),
            correctSequence: JSON.stringify([3, 1, 2, 0]),
            type: "sequence",
            difficultyPreset: 3
          },
          // Еще single_choice для истории
          {
            text: "Кто был лидером Кубинской революции?",
            options: JSON.stringify(["Эрнесто Че Гевара", "Фидель Кастро", "Рауль Кастро", "Камило Сьенфуэгос"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "В каком году была отменена крепостное право в России?",
            options: JSON.stringify(["1801", "1825", "1861", "1905"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Кто был первым премьер-министром Великобритании?",
            options: JSON.stringify(["Уинстон Черчилль", "Роберт Уолпол", "Бенджамин Дизраэли", "Уильям Гладстон"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какой город был столицей Османской империи?",
            options: JSON.stringify(["Анкара", "Стамбул", "Бурса", "Эдирне"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 2
          }
        ]
      },
      // Искусство (art) - 20 вопросов
      {
        topicSlug: 'art',
        questions: [
          {
            text: "Кто написал картину 'Мона Лиза'?",
            options: JSON.stringify(["Винсент Ван Гог", "Леонардо да Винчи", "Пабло Пикассо", "Рафаэль"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой художник известен картинами с подсолнухами?",
            options: JSON.stringify(["Клод Моне", "Сальвадор Дали", "Винсент Ван Гог", "Поль Гоген"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто создал скульптуру 'Давид'?",
            options: JSON.stringify(["Донателло", "Микеланджело", "Бернини", "Роден"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой художник основал кубизм?",
            options: JSON.stringify(["Пабло Пикассо", "Анри Матисс", "Марк Шагал", "Василий Кандинский"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Кто написал 'Тайную вечерю'?",
            options: JSON.stringify(["Рафаэль", "Тициан", "Леонардо да Винчи", "Караваджо"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой художник известен 'Капеллой Сикстина'?",
            options: JSON.stringify(["Рафаэль", "Микеланджело", "Боттичелли", "Тициан"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто является автором картины 'Крик'?",
            options: JSON.stringify(["Эдвард Мунк", "Винсент Ван Гог", "Пауль Клее", "Фрэнсис Бэкон"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой художник писал 'водяные лилии'?",
            options: JSON.stringify(["Клод Моне", "Огюст Ренуар", "Эдгар Дега", "Пьер-Огюст Ренуар"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто создал 'Гернику'?",
            options: JSON.stringify(["Пабло Пикассо", "Сальвадор Дали", "Жоан Миро", "Фрида Кало"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой архитектор спроектировал собор Святого Петра в Риме?",
            options: JSON.stringify(["Браманте", "Микеланджело", "Бернини", "Все вышеперечисленные"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Кто написал 'Рождение Венеры'?",
            options: JSON.stringify(["Боттичелли", "Тициан", "Рафаэль", "Караваджо"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой художник был одним из основателей импрессионизма?",
            options: JSON.stringify(["Эдуард Мане", "Клод Моне", "Пьер-Огюст Ренуар", "Все вышеперечисленные"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Кто создал 'Мыслителя'?",
            options: JSON.stringify(["Огюст Роден", "Антонио Канова", "Донателло", "Микеланджело"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          // sequence вопросы для искусства
          {
            text: "Расположите эти художественные стили в хронологическом порядке",
            options: JSON.stringify(["Кубизм", "Ренессанс", "Импрессионизм", "Барокко"]),
            correctSequence: JSON.stringify([1, 3, 2, 0]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расставьте этих художников по году рождения (от самого раннего)",
            options: JSON.stringify(["Ван Гог", "Леонардо да Винчи", "Пабло Пикассо", "Сальвадор Дали"]),
            correctSequence: JSON.stringify([1, 0, 2, 3]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расположите эти архитектурные стили по времени возникновения",
            options: JSON.stringify(["Готика", "Романский", "Барокко", "Модерн"]),
            correctSequence: JSON.stringify([1, 0, 2, 3]),
            type: "sequence",
            difficultyPreset: 2
          },
          // Еще single_choice для искусства
          {
            text: "Кто является автором фрески 'Сотворение Адама'?",
            options: JSON.stringify(["Рафаэль", "Микеланджело", "Леонардо да Винчи", "Тициан"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой музей находится в Париже и известен своей стеклянной пирамидой?",
            options: JSON.stringify(["Лувр", "Музей д'Орсе", "Центр Помпиду", "Музей Родена"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто написал 'Авиньонских девиц'?",
            options: JSON.stringify(["Пабло Пикассо", "Анри Матисс", "Жорж Брак", "Хуан Грис"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какой художник известен своими 'супрематическими' композициями?",
            options: JSON.stringify(["Казимир Малевич", "Василий Кандинский", "Марк Шагал", "Эль Лисицкий"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 2
          }
        ]
      },
      // Игры (games) - 20 вопросов
      {
        topicSlug: 'games',
        questions: [
          {
            text: "Какая компания создала игровую консоль PlayStation?",
            options: JSON.stringify(["Nintendo", "Microsoft", "Sega", "Sony"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "В какой серии игр главного героя зовут Марио?",
            options: JSON.stringify(["The Legend of Zelda", "Super Mario", "Final Fantasy", "Sonic the Hedgehog"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Как зовут главного героя The Legend of Zelda?",
            options: JSON.stringify(["Зельда", "Линк", "Ганондорф", "Нави"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "В какой игре появился персонаж Мастер Чиф?",
            options: JSON.stringify(["Call of Duty", "Halo", "Battlefield", "Destiny"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Как называется студия, создавшая The Witcher 3?",
            options: JSON.stringify(["BioWare", "CD Projekt Red", "Bethesda", "Ubisoft"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой жанр у игры Minecraft?",
            options: JSON.stringify(["Шутер", "Песочница", "RPG", "Стратегия"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто главный герой серии игр God of War?",
            options: JSON.stringify(["Зевс", "Кратос", "Один", "Тор"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "В каком году вышла первая игра серии Super Mario?",
            options: JSON.stringify(["1983", "1985", "1987", "1990"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какая игра считается первой в жанре MOBA?",
            options: JSON.stringify(["Dota", "League of Legends", "Aeon of Strife", "Heroes of the Storm"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Как называется первая игра серии Grand Theft Auto?",
            options: JSON.stringify(["GTA", "GTA London 1969", "GTA 2", "GTA III"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Кто создал серию игр Metal Gear?",
            options: JSON.stringify(["Хидэо Кодзима", "Сид Мейер", "Уоррен Спектор", "Тим Шейфер"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой движок используется в Fortnite?",
            options: JSON.stringify(["Unity", "Unreal Engine", "Frostbite", "Source"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "В какой игре появился персонаж Эцио Аудиторе?",
            options: JSON.stringify(["Prince of Persia", "Assassin's Creed II", "Dishonored", "Thief"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          // sequence вопросы для игр
          {
            text: "Расположите эти игровые консоли по году выхода (от самой старой)",
            options: JSON.stringify(["PlayStation 4", "Nintendo NES", "Xbox 360", "PlayStation 2"]),
            correctSequence: JSON.stringify([1, 3, 2, 0]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расставьте эти игры по году выхода (от самой старой)",
            options: JSON.stringify(["The Legend of Zelda: Ocarina of Time", "Super Mario 64", "Final Fantasy VII", "Half-Life"]),
            correctSequence: JSON.stringify([1, 2, 0, 3]),
            type: "sequence",
            difficultyPreset: 3
          },
          {
            text: "Расположите эти игровые жанры по популярности в хронологическом порядке возникновения",
            options: JSON.stringify(["Battle Royale", "Платформер", "MMORPG", "Шутер от первого лица"]),
            correctSequence: JSON.stringify([1, 3, 2, 0]),
            type: "sequence",
            difficultyPreset: 2
          },
          // Еще single_choice для игр
          {
            text: "Какой персонаж является талисманом компании Sega?",
            options: JSON.stringify(["Соник", "Марио", "Кратос", "Солид Снейк"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "В какой игре впервые появилась механика 'брют-форс'?",
            options: JSON.stringify(["Doom", "Wolfenstein 3D", "Quake", "Duke Nukem 3D"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Как называется студия, создавшая серию игр Dark Souls?",
            options: JSON.stringify(["FromSoftware", "Bandai Namco", "Capcom", "Square Enix"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какая игра установила рекорд по самым быстрым продажам в истории?",
            options: JSON.stringify(["Cyberpunk 2077", "Grand Theft Auto V", "Call of Duty: Modern Warfare", "Red Dead Redemption 2"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 2
          }
        ]
      },
      // Фильмы и сериалы (movies-tv) - 20 вопросов
      {
        topicSlug: 'movies-tv',
        questions: [
          {
            text: "Как звали режиссера фильма 'Крестный отец'?",
            options: JSON.stringify(["Мартин Скорсезе", "Фрэнсис Форд Коппола", "Стивен Спилберг", "Квентин Тарантино"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "В какой киновселенной есть персонаж Тони Старк?",
            options: JSON.stringify(["DC", "Marvel", "Звездные войны", "Властелин колец"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто сыграл Нео в 'Матрице'?",
            options: JSON.stringify(["Киану Ривз", "Лоренс Фишбёрн", "Хьюго Уивинг", "Кэрри-Энн Мосс"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой фильм получил Оскар за лучший фильм в 2020 году?",
            options: JSON.stringify(["Джокер", "Паразиты", "1917", "Однажды в Голливуде"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто режиссер фильма 'Начало'?",
            options: JSON.stringify(["Кристофер Нолан", "Дэвид Финчер", "Дени Вильнёв", "Ридли Скотт"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Сколько фильмов в оригинальной трилогии 'Звездных войн'?",
            options: JSON.stringify(["3", "4", "5", "6"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто сыграл Джеймса Бонда в фильме 'Казино Рояль' 2006?",
            options: JSON.stringify(["Шон Коннери", "Роджер Мур", "Пирс Броснан", "Дэниел Крэйг"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой фильм является самым кассовым в истории?",
            options: JSON.stringify(["Титаник", "Аватар", "Мстители: Финал", "Звездные войны: Пробуждение силы"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто режиссер 'Криминального чтива'?",
            options: JSON.stringify(["Гай Ричи", "Квентин Тарантино", "Мартин Скорсезе", "Братья Коэн"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой актер сыграл Джокера в фильме 2019 года?",
            options: JSON.stringify(["Хит Леджер", "Джаред Лето", "Хоакин Феникс", "Джек Николсон"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Сколько сезонов в сериале 'Игра престолов'?",
            options: JSON.stringify(["6", "7", "8", "9"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто снял 'Список Шиндлера'?",
            options: JSON.stringify(["Стивен Спилберг", "Роман Полански", "Оливер Стоун", "Клинт Иствуд"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой фильм выиграл 11 Оскаров?",
            options: JSON.stringify(["Титаник", "Властелин колец: Возвращение короля", "Бен-Гур", "Все они"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 1
          },
          // sequence вопросы для фильмов
          {
            text: "Расположите эти фильмы по году выхода (от самого старого)",
            options: JSON.stringify(["Аватар", "Крестный отец", "Титаник", "Парк Юрского периода"]),
            correctSequence: JSON.stringify([1, 3, 2, 0]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расставьте этих режиссеров по году рождения (от самого раннего)",
            options: JSON.stringify(["Квентин Тарантино", "Стивен Спилберг", "Кристофер Нолан", "Мартин Скорсезе"]),
            correctSequence: JSON.stringify([1, 3, 0, 2]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расположите эти фильмы по кассовым сборам (от наименьших)",
            options: JSON.stringify(["Титаник", "Аватар", "Мстители: Финал", "Звездные войны: Пробуждение силы"]),
            correctSequence: JSON.stringify([0, 3, 2, 1]),
            type: "sequence",
            difficultyPreset: 2
          },
          // Еще single_choice для фильмов
          {
            text: "Какой фильм считается первым полнометражным анимационным?",
            options: JSON.stringify(["Белоснежка и семь гномов", "Пиноккио", "Бэмби", "Фантазия"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Кто сыграл Индиану Джонса?",
            options: JSON.stringify(["Харрисон Форд", "Шон Коннери", "Мэл Гибсон", "Том Селлек"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой фильм является адаптацией романа Стивена Кинга 'Побег из Шоушенка'?",
            options: JSON.stringify(["Зеленая миля", "Оно", "Побег из Шоушенка", "Сияние"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Кто режиссер трилогии 'Властелин колец'?",
            options: JSON.stringify(["Стивен Спилберг", "Питер Джексон", "Джордж Лукас", "Джеймс Кэмерон"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          }
        ]
      },
      // Животные (animals) - 20 вопросов
      {
        topicSlug: 'animals',
        questions: [
          {
            text: "Какое животное является самым большим на Земле?",
            options: JSON.stringify(["Африканский слон", "Синий кит", "Жираф", "Белый медведь"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Сколько сердец у осьминога?",
            options: JSON.stringify(["1", "2", "3", "4"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какое животное является самым быстрым на суше?",
            options: JSON.stringify(["Лев", "Гепард", "Антилопа", "Леопард"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Сколько жизней, по преданию, у кошки?",
            options: JSON.stringify(["5", "7", "9", "13"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какое животное является символом мудрости?",
            options: JSON.stringify(["Волк", "Сова", "Слон", "Дельфин"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Как называется детеныш тюленя?",
            options: JSON.stringify(["Тюлененок", "Белек", "Щенок", "Детеныш"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какое животное имеет самый большой мозг относительно тела?",
            options: JSON.stringify(["Человек", "Дельфин", "Слон", "Муравей"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Сколько пальцев у кошки на передней лапе?",
            options: JSON.stringify(["4", "5", "6", "7"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какое животное может поворачивать голову на 270 градусов?",
            options: JSON.stringify(["Сова", "Жираф", "Змея", "Хамелеон"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Как называется группа львов?",
            options: JSON.stringify(["Стая", "Прайд", "Клан", "Семья"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какое животное спит стоя?",
            options: JSON.stringify(["Лошадь", "Слон", "Жираф", "Все вышеперечисленные"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Сколько камер в сердце птицы?",
            options: JSON.stringify(["2", "3", "4", "5"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какое животное имеет самый громкий голос?",
            options: JSON.stringify(["Лев", "Синий кит", "Слон", "Обезьяна-ревуна"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          // sequence вопросы для животных
          {
            text: "Расположите этих животных по максимальной скорости (от самого медленного)",
            options: JSON.stringify(["Гепард", "Слон", "Лошадь", "Человек"]),
            correctSequence: JSON.stringify([1, 3, 2, 0]),
            type: "sequence",
            difficultyPreset: 1
          },
          {
            text: "Расставьте этих животных по продолжительности жизни (от самой короткой)",
            options: JSON.stringify(["Черепаха", "Мышь", "Слон", "Попугай"]),
            correctSequence: JSON.stringify([1, 2, 3, 0]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расположите этих животных по весу (от самого легкого)",
            options: JSON.stringify(["Синий кит", "Слон", "Медведь", "Человек"]),
            correctSequence: JSON.stringify([3, 2, 1, 0]),
            type: "sequence",
            difficultyPreset: 1
          },
          // Еще single_choice для животных
          {
            text: "Какое животное может регенерировать потерянные конечности?",
            options: JSON.stringify(["Ящерица", "Звезда морская", "Осьминог", "Все вышеперечисленные"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Сколько видов пингвинов существует?",
            options: JSON.stringify(["10", "17", "22", "28"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какое животное самое ядовитое в мире?",
            options: JSON.stringify(["Королевская кобра", "Скорпион", "Кубомедуза", "Древолаз"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Сколько лет живет средний домашний кот?",
            options: JSON.stringify(["5-7 лет", "10-13 лет", "15-20 лет", "25-30 лет"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          }
        ]
      },
      // Еда (food) - 20 вопросов
      {
        topicSlug: 'food',
        questions: [
          {
            text: "Из какой страны родом пицца Маргарита?",
            options: JSON.stringify(["США", "Италия", "Франция", "Греция"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой сыр используется в классической пицце Маргарита?",
            options: JSON.stringify(["Чеддер", "Моцарелла", "Пармезан", "Гауда"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Из какой страны родом суши?",
            options: JSON.stringify(["Китай", "Япония", "Корея", "Таиланд"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой напиток делают из какао-бобов?",
            options: JSON.stringify(["Кофе", "Чай", "Какао", "Все вышеперечисленные"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой фрукт является самым популярным в мире?",
            options: JSON.stringify(["Яблоко", "Банан", "Апельсин", "Виноград"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой овощ содержит больше всего воды?",
            options: JSON.stringify(["Огурец", "Помидор", "Капуста", "Морковь"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой сыр имеет дырки?",
            options: JSON.stringify(["Гауда", "Чеддер", "Эмменталь", "Бри"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Из какой страны родом паэлья?",
            options: JSON.stringify(["Италия", "Испания", "Франция", "Португалия"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой соус является основным для блюда 'Карбонара'?",
            options: JSON.stringify(["Томатный", "Сливочный", "Сырный", "Яичный"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой ингредиент НЕ входит в классический салат Цезарь?",
            options: JSON.stringify(["Салат романо", "Пармезан", "Гренки", "Помидоры"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой вид риса используется для суши?",
            options: JSON.stringify(["Басмати", "Жасмин", "Арборио", "Нишики"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Из какой страны родом хумус?",
            options: JSON.stringify(["Греция", "Турция", "Ливан", "Все претендуют"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какой перец самый острый в мире?",
            options: JSON.stringify(["Халапеньо", "Хабанеро", "Каролинский жнец", "Скорпион Тринидада"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 2
          },
          // sequence вопросы для еды
          {
            text: "Расположите эти блюда по калорийности (от самого низкокалорийного)",
            options: JSON.stringify(["Салат Цезарь", "Чизбургер", "Яблоко", "Картофель фри"]),
            correctSequence: JSON.stringify([2, 0, 3, 1]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расставьте эти сыры по твердости (от самого мягкого)",
            options: JSON.stringify(["Пармезан", "Бри", "Чеддер", "Моцарелла"]),
            correctSequence: JSON.stringify([1, 3, 2, 0]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расположите эти фрукты по содержанию витамина C (от наибольшего)",
            options: JSON.stringify(["Апельсин", "Киви", "Клубника", "Лимон"]),
            correctSequence: JSON.stringify([1, 2, 0, 3]),
            type: "sequence",
            difficultyPreset: 2
          },
          // Еще single_choice для еды
          {
            text: "Какой напиток известен как 'напиток богов' у ацтеков?",
            options: JSON.stringify(["Какао", "Чай", "Кофе", "Вино"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какой продукт является основным для тайского карри?",
            options: JSON.stringify(["Кокосовое молоко", "Сливки", "Томатная паста", "Йогурт"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой вид мяса используется в классическом венском шницеле?",
            options: JSON.stringify(["Свинина", "Говядина", "Телятина", "Курица"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какой фрукт является ягодой?",
            options: JSON.stringify(["Вишня", "Клубника", "Банан", "Все вышеперечисленные"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 2
          }
        ]
      },
      // География (geography) - 20 вопросов
      {
        topicSlug: 'geography',
        questions: [
          {
            text: "Какая самая длинная река в мире?",
            options: JSON.stringify(["Амазонка", "Нил", "Янцзы", "Миссисипи"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какая страна имеет форму сапога?",
            options: JSON.stringify(["Греция", "Италия", "Испания", "Франция"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какая самая большая страна по площади?",
            options: JSON.stringify(["Канада", "США", "Китай", "Россия"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой океан самый глубокий?",
            options: JSON.stringify(["Атлантический", "Индийский", "Тихий", "Северный Ледовитый"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какая пустыня самая большая в мире?",
            options: JSON.stringify(["Сахара", "Гоби", "Аравийская", "Калахари"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой водопад является самым высоким в мире?",
            options: JSON.stringify(["Ниагарский", "Виктория", "Анхель", "Игуасу"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какая гора является самой высокой в мире?",
            options: JSON.stringify(["Килиманджаро", "Эверест", "Мак-Кинли", "Аконкагуа"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Сколько штатов в США?",
            options: JSON.stringify(["48", "50", "52", "54"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какая река протекает через Париж?",
            options: JSON.stringify(["Сена", "Темза", "Дунай", "Рейн"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой город является столицей Австралии?",
            options: JSON.stringify(["Сидней", "Мельбурн", "Канберра", "Брисбен"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какое озеро является самым глубоким в мире?",
            options: JSON.stringify(["Виктория", "Байкал", "Танганьика", "Верхнее"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой пролив разделяет Европу и Африку?",
            options: JSON.stringify(["Гибралтарский", "Босфор", "Дарданеллы", "Магелланов"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какая страна имеет наибольшее количество островов?",
            options: JSON.stringify(["Индонезия", "Филиппины", "Швеция", "Канада"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 2
          },
          // sequence вопросы для географии
          {
            text: "Расположите эти горы по высоте (от самой низкой)",
            options: JSON.stringify(["Эльбрус", "Килиманджаро", "Эверест", "Монблан"]),
            correctSequence: JSON.stringify([3, 0, 1, 2]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расставьте эти страны по площади (от самой маленькой)",
            options: JSON.stringify(["Россия", "Канада", "Китай", "США"]),
            correctSequence: JSON.stringify([2, 3, 1, 0]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расположите эти реки по длине (от самой короткой)",
            options: JSON.stringify(["Амазонка", "Нил", "Янцзы", "Миссисипи"]),
            correctSequence: JSON.stringify([3, 2, 1, 0]),
            type: "sequence",
            difficultyPreset: 3
          },
          // Еще single_choice для географии
          {
            text: "Какой город является самым северным в мире с населением более 1 млн?",
            options: JSON.stringify(["Осло", "Хельсинки", "Санкт-Петербург", "Стокгольм"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какая страна имеет наибольшее количество часовых поясов?",
            options: JSON.stringify(["США", "Канада", "Россия", "Китай"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой вулкан является самым активным в мире?",
            options: JSON.stringify(["Этна", "Килауэа", "Фудзияма", "Везувий"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какая страна является родиной чая?",
            options: JSON.stringify(["Индия", "Китай", "Япония", "Шри-Ланка"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          }
        ]
      },
      // Литература (literature) - 20 вопросов
      {
        topicSlug: 'literature',
        questions: [
          {
            text: "Кто написал роман 'Война и мир'?",
            options: JSON.stringify(["Федор Достоевский", "Лев Толстой", "Александр Пушкин", "Антон Чехов"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Как звали автора серии книг о Гарри Поттере?",
            options: JSON.stringify(["Джон Толкин", "Джоан Роулинг", "Джордж Мартин", "Клайв Льюис"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто написал 'Преступление и наказание'?",
            options: JSON.stringify(["Лев Толстой", "Федор Достоевский", "Николай Гоголь", "Иван Тургенев"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой писатель создал Шерлока Холмса?",
            options: JSON.stringify(["Агата Кристи", "Артур Конан Дойл", "Эдгар Аллан По", "Рэймонд Чандлер"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто написал 'Ромео и Джульетту'?",
            options: JSON.stringify(["Чарльз Диккенс", "Уильям Шекспир", "Джейн Остин", "Марк Твен"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой автор написал 'Властелина колец'?",
            options: JSON.stringify(["Джон Толкин", "Клайв Льюис", "Джордж Мартин", "Терри Пратчетт"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто является автором 'Мастера и Маргариты'?",
            options: JSON.stringify(["Михаил Булгаков", "Александр Солженицын", "Владимир Набоков", "Иван Бунин"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой писатель получил Нобелевскую премию по литературе в 1958?",
            options: JSON.stringify(["Эрнест Хемингуэй", "Альбер Камю", "Борис Пастернак", "Жан-Поль Сартр"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Кто написал 'Гордость и предубеждение'?",
            options: JSON.stringify(["Шарлотта Бронте", "Джейн Остин", "Эмили Бронте", "Мэри Шелли"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой русский писатель умер на дуэли?",
            options: JSON.stringify(["Михаил Лермонтов", "Александр Пушкин", "Николай Гоголь", "Иван Тургенев"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Кто создал детектива Эркюля Пуаро?",
            options: JSON.stringify(["Артур Конан Дойл", "Агата Кристи", "Дороти Сэйерс", "Рэймонд Чандлер"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой писатель известен под псевдонимом Марк Твен?",
            options: JSON.stringify(["Сэмюэл Клеменс", "Уильям Фолкнер", "Теодор Драйзер", "Генри Джеймс"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Кто написал 'Старик и море'?",
            options: JSON.stringify(["Эрнест Хемингуэй", "Фрэнсис Скотт Фицджеральд", "Джон Стейнбек", "Уильям Фолкнер"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          // sequence вопросы для литературы
          {
            text: "Расставьте этих писателей по хронологии (от самого раннего)",
            options: JSON.stringify(["Федор Достоевский", "Уильям Шекспир", "Лев Толстой", "Александр Пушкин"]),
            correctSequence: JSON.stringify([1, 3, 0, 2]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расположите эти литературные произведения по году написания (от самого раннего)",
            options: JSON.stringify(["Война и мир", "Преступление и наказание", "Евгений Онегин", "Мастер и Маргарита"]),
            correctSequence: JSON.stringify([2, 1, 0, 3]),
            type: "sequence",
            difficultyPreset: 3
          },
          {
            text: "Расставьте эти литературные жанры по времени возникновения",
            options: JSON.stringify(["Роман", "Поэма", "Новелла", "Эпопея"]),
            correctSequence: JSON.stringify([3, 1, 2, 0]),
            type: "sequence",
            difficultyPreset: 2
          },
          // Еще single_choice для литературы
          {
            text: "Кто написал 'Три мушкетера'?",
            options: JSON.stringify(["Виктор Гюго", "Александр Дюма", "Жюль Верн", "Оноре де Бальзак"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой писатель провел 27 лет в тюрьме и написал 'Дон Кихота'?",
            options: JSON.stringify(["Мигель де Сервантес", "Федерико Гарсиа Лорка", "Пабло Неруда", "Габриэль Гарсиа Маркес"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Кто является автором цикла 'Песнь льда и пламени'?",
            options: JSON.stringify(["Джордж Мартин", "Джон Толкин", "Терри Гудкайнд", "Роберт Джордан"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой русский писатель получил Нобелевскую премию в 1970?",
            options: JSON.stringify(["Александр Солженицын", "Михаил Шолохов", "Борис Пастернак", "Иосиф Бродский"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 2
          }
        ]
      },
      // Музыка (music) - 20 вопросов
      {
        topicSlug: 'music',
        questions: [
          {
            text: "Кто написал 'Лунную сонату'?",
            options: JSON.stringify(["Вольфганг Амадей Моцарт", "Людвиг ван Бетховен", "Иоганн Себастьян Бах", "Петр Чайковский"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой инструмент относится к духовым?",
            options: JSON.stringify(["Скрипка", "Фортепиано", "Труба", "Гитара"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто является 'королем поп-музыки'?",
            options: JSON.stringify(["Майкл Джексон", "Элвис Пресли", "Принс", "Дэвид Боуи"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой композитор написал 'Времена года'?",
            options: JSON.stringify(["Иоганн Себастьян Бах", "Антонио Вивальди", "Вольфганг Амадей Моцарт", "Людвиг ван Бетховен"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто фронтмен группы Queen?",
            options: JSON.stringify(["Фредди Меркьюри", "Роджер Тейлор", "Брайан Мэй", "Джон Дикон"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой музыкальный жанр зародился на Ямайке?",
            options: JSON.stringify(["Рэгги", "Джаз", "Блюз", "Соул"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто написал оперу 'Кармен'?",
            options: JSON.stringify(["Джузеппе Верди", "Жорж Бизе", "Джакомо Пуччини", "Рихард Вагнер"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой инструмент имеет 88 клавиш?",
            options: JSON.stringify(["Орган", "Пианино", "Аккордеон", "Клавесин"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто является автором симфонии №5?",
            options: JSON.stringify(["Вольфганг Амадей Моцарт", "Людвиг ван Бетховен", "Иоганн Себастьян Бах", "Франц Шуберт"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой музыкальный коллектив записал альбом 'The Dark Side of the Moon'?",
            options: JSON.stringify(["Led Zeppelin", "Pink Floyd", "The Beatles", "The Rolling Stones"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто написал балет 'Лебединое озеро'?",
            options: JSON.stringify(["Петр Чайковский", "Игорь Стравинский", "Сергей Прокофьев", "Морис Равель"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой американский певец известен как 'Голос'?",
            options: JSON.stringify(["Фрэнк Синатра", "Дин Мартин", "Тони Беннетт", "Сэми Дэвис"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Кто считается 'королем рок-н-ролла'?",
            options: JSON.stringify(["Чак Берри", "Элвис Пресли", "Билл Хейли", "Литл Ричард"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          // sequence вопросы для музыки
          {
            text: "Расположите эти музыкальные стили по времени появления (от самого раннего)",
            options: JSON.stringify(["Хип-хоп", "Классическая музыка", "Рок-н-ролл", "Джаз"]),
            correctSequence: JSON.stringify([1, 3, 2, 0]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расставьте этих композиторов по году рождения (от самого раннего)",
            options: JSON.stringify(["Людвиг ван Бетховен", "Вольфганг Амадей Моцарт", "Иоганн Себастьян Бах", "Петр Чайковский"]),
            correctSequence: JSON.stringify([2, 1, 0, 3]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расположите эти музыкальные инструменты по размеру (от самого маленького)",
            options: JSON.stringify(["Контрабас", "Скрипка", "Альт", "Виолончель"]),
            correctSequence: JSON.stringify([1, 2, 3, 0]),
            type: "sequence",
            difficultyPreset: 2
          },
          // Еще single_choice для музыки
          {
            text: "Кто написал музыкальную тему для фильма 'Пираты Карибского моря'?",
            options: JSON.stringify(["Джон Уильямс", "Ханс Циммер", "Эннио Морриконе", "Джерри Голдсмит"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой музыкальный коллектив первым использовал синтезатор Муга?",
            options: JSON.stringify(["The Beatles", "The Doors", "Pink Floyd", "The Beach Boys"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Кто является самой продаваемой певицей всех времен?",
            options: JSON.stringify(["Мадонна", "Уитни Хьюстон", "Мария Кэри", "Бейонсе"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Какой композитор написал 'Танец маленьких лебедей'?",
            options: JSON.stringify(["Петр Чайковский", "Игорь Стравинский", "Сергей Прокофьев", "Модест Мусоргский"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          }
        ]
      },
      // Наука (science) - 20 вопросов
      {
        topicSlug: 'science',
        questions: [
          {
            text: "Сколько планет в Солнечной системе?",
            options: JSON.stringify(["7", "8", "9", "10"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой ученый сформулировал теорию относительности?",
            options: JSON.stringify(["Исаак Ньютон", "Альберт Эйнштейн", "Никола Тесла", "Мария Кюри"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой газ растения поглощают во время фотосинтеза?",
            options: JSON.stringify(["Кислород", "Углекислый газ", "Азот", "Водород"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто открыл пенициллин?",
            options: JSON.stringify(["Александр Флеминг", "Луи Пастер", "Роберт Кох", "Джозеф Листер"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой элемент имеет атомный номер 1?",
            options: JSON.stringify(["Гелий", "Водород", "Литий", "Углерод"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто предложил гелиоцентрическую систему мира?",
            options: JSON.stringify(["Аристотель", "Птолемей", "Коперник", "Галилей"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Как называется наука о живых организмах?",
            options: JSON.stringify(["Химия", "Физика", "Биология", "Геология"]),
            correctOption: 2,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Кто открыл закон всемирного тяготения?",
            options: JSON.stringify(["Альберт Эйнштейн", "Исаак Ньютон", "Галилео Галилей", "Никола Тесла"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Какой прибор измеряет атмосферное давление?",
            options: JSON.stringify(["Термометр", "Барометр", "Гигрометр", "Анемометр"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Кто открыл рентгеновские лучи?",
            options: JSON.stringify(["Мария Кюри", "Вильгельм Рентген", "Антуан Беккерель", "Эрнест Резерфорд"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Как называется самая большая частица в атоме?",
            options: JSON.stringify(["Электрон", "Протон", "Нейтрон", "Ядро"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 1
          },
          {
            text: "Кто сформулировал периодический закон химических элементов?",
            options: JSON.stringify(["Антуан Лавуазье", "Дмитрий Менделеев", "Роберт Бойль", "Джон Дальтон"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 0
          },
          {
            text: "Как называется процесс деления клетки?",
            options: JSON.stringify(["Митоз", "Мейоз", "Осмос", "Диффузия"]),
            correctOption: 0,
            type: "single_choice",
            difficultyPreset: 1
          },
          // sequence вопросы для науки
          {
            text: "Расположите эти элементы по атомному номеру (от самого маленького)",
            options: JSON.stringify(["Кислород (O)", "Углерод (C)", "Водород (H)", "Азот (N)"]),
            correctSequence: JSON.stringify([2, 1, 3, 0]),
            type: "sequence",
            difficultyPreset: 2
          },
          {
            text: "Расставьте эти планеты по удаленности от Солнца (от ближайшей)",
            options: JSON.stringify(["Земля", "Венера", "Марс", "Меркурий"]),
            correctSequence: JSON.stringify([3, 1, 0, 2]),
            type: "sequence",
            difficultyPreset: 1
          },
          {
            text: "Расположите эти научные открытия по хронологии (от самого раннего)",
            options: JSON.stringify(["Теория относительности", "Закон всемирного тяготения", "Пенициллин", "Структура ДНК"]),
            correctSequence: JSON.stringify([1, 0, 2, 3]),
            type: "sequence",
            difficultyPreset: 3
          },
          // Еще single_choice для науки
          {
            text: "Какой ученый открыл радиоактивность?",
            options: JSON.stringify(["Мария Кюри", "Антуан Беккерель", "Эрнест Резерфорд", "Нильс Бор"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Как называется самая маленькая частица вещества?",
            options: JSON.stringify(["Атом", "Молекула", "Электрон", "Кварк"]),
            correctOption: 3,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Кто открыл вирусы?",
            options: JSON.stringify(["Луи Пастер", "Дмитрий Ивановский", "Роберт Кох", "Эдвард Дженнер"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 2
          },
          {
            text: "Какой химический элемент необходим для горения?",
            options: JSON.stringify(["Азот", "Кислород", "Водород", "Углерод"]),
            correctOption: 1,
            type: "single_choice",
            difficultyPreset: 1
          }
        ]
      }
    ];

    console.log('\nСоздаем вопросы...');
    let questionCount = 0;

    for (const topicQuestions of questionsData) {
      const topic = createdTopics.find(t => t.slug === topicQuestions.topicSlug);

      if (!topic) {
        console.error(`Тема с slug "${topicQuestions.topicSlug}" не найдена!`);
        continue;
      }

      console.log(`\nДобавляем вопросы для темы: ${topic.name}`);

      for (const questionData of topicQuestions.questions) {
        await prisma.question.create({
          data: {
            topicId: topic.id,
            text: questionData.text,
            options: questionData.options,
            correctOption: questionData.correctOption,
            correctSequence: questionData.correctSequence,
            type: questionData.type,
            difficultyPreset: questionData.difficultyPreset,
            // createdAt автоматически добавляется благодаря @default(now())
          }
        });
        questionCount++;
        console.log(`  ✓ Добавлен вопрос: "${questionData.text.substring(0, 50)}..."`);
      }
    }

    console.log(`\n✅ Заполнение завершено!`);
    console.log(`Создано: ${createdTopics.length} тем`);
    console.log(`Создано: ${questionCount} вопросов`);

  } catch (error) {
    console.error('Ошибка при заполнении базы данных:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем заполнение базы данных
seedDatabase();