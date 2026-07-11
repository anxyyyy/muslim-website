/**
 * МАЗХАБ — Мусульманский веб-портал
 * Логика приложения (чистый функциональный JavaScript без классов)
 */

(function () {
  'use strict';

  /* ----------------------------------------------------
     ГЛОБАЛЬНОЕ СОСТОЯНИЕ (STATE)
     ---------------------------------------------------- */
  const state = {
    // Координаты по умолчанию (Душанбе)
    coords: {
      lat: 38.5358,
      lng: 68.7791
    },
    cityName: 'Душанбе',
    hijriDate: '25 Мухаррам 1448 г.х.',
    gregorianDate: 'Суббота, 11 июля 2026',
    
    // Расчет времени
    prayerTimings: null,
    calculationMethod: '14', // ДУМ РФ по умолчанию
    asrMethod: '0', // Стандартный (Шафии/Малики/Ханбали)
    
    // Кибла
    qiblaAngle: 244,
    qiblaDistance: 3412,
    deviceHeading: 0,
    
    // Коран
    selectedSurah: 1,
    reciter: 'ar.alafasy',
    fontSize: 28,
    surahList: [],
    currentSurahVerses: [],
    
    // Аудио-плеер
    audioPlaying: false,
    currentAyahIndex: 0,
    audioUrls: [],
    
    // Карта
    mapInstance: null,
    mapUserMarker: null,
    mapMeccaMarker: null,
    mapPolyline: null,

    // Обучение
    learnMode: 'namaz',
    learnGender: 'male',
    learnStepIndex: 0,

    // Сенсоры
    useSensors: true
  };

  const MECCA_COORDS = { lat: 21.4225, lng: 39.8262 };

  /* ----------------------------------------------------
     ИНИЦИАЛИЗАЦИЯ
     ---------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    loadSettingsFromStorage();
    initTheme();
    initAppElements();
    requestUserLocation();
    loadSurahList();
    loadSurahContent(state.selectedSurah);
    initAudioPlayerListeners();
    initLearningSection();
  });

  /* ----------------------------------------------------
     НАСТРОЙКИ И ТЕМА
     ---------------------------------------------------- */
  function loadSettingsFromStorage() {
    const savedLat = localStorage.getItem('mazhab_lat');
    const savedLng = localStorage.getItem('mazhab_lng');
    const savedCity = localStorage.getItem('mazhab_city');
    const savedMethod = localStorage.getItem('mazhab_method');
    const savedAsr = localStorage.getItem('mazhab_asr');
    const savedFontSize = localStorage.getItem('mazhab_font_size');
    const savedTheme = localStorage.getItem('mazhab_theme');

    if (savedLat && savedLng) {
      state.coords.lat = parseFloat(savedLat);
      state.coords.lng = parseFloat(savedLng);
    }
    if (savedCity) state.cityName = savedCity;
    if (savedMethod) state.calculationMethod = savedMethod;
    if (savedAsr) state.asrMethod = savedAsr;
    if (savedFontSize) state.fontSize = parseInt(savedFontSize);
    if (savedTheme) state.isDarkTheme = savedTheme === 'dark';
  }

  function initTheme() {
    if (state.isDarkTheme) {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    } else {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    }
  }

  function toggleTheme() {
    state.isDarkTheme = !state.isDarkTheme;
    localStorage.setItem('mazhab_theme', state.isDarkTheme ? 'dark' : 'light');
    initTheme();
  }

  /* ----------------------------------------------------
     ИНИЦИАЛИЗАЦИЯ И СЛУШАТЕЛИ UI
     ---------------------------------------------------- */
  function initAppElements() {
    // Навигация
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        e.target.classList.add('active');
      });
    });

    // Кнопка в шапке
    document.getElementById('open-app-btn').addEventListener('click', () => {
      document.getElementById('prayer-section').scrollIntoView({ behavior: 'smooth' });
    });

    // Кнопка Киблы
    document.getElementById('panel-qibla-btn').addEventListener('click', () => {
      document.getElementById('qibla-section').scrollIntoView({ behavior: 'smooth' });
    });
    
    // Кнопка разрешения датчиков гироскопа
    const enableCompassBtn = document.getElementById('enable-compass-btn');
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      enableCompassBtn.style.display = 'inline-flex';
      enableCompassBtn.addEventListener('click', requestCompassPermission);
    } else {
      if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      } else {
        window.addEventListener('deviceorientation', handleOrientation, true);
      }
    }
    
    // Инициализация перетаскивания компаса (для десктопа/ручного теста)
    initCompassDrag();

    // Изменение города (Модальное окно)
    document.getElementById('change-city-btn').addEventListener('click', () => openModal('city-modal'));
    document.getElementById('city-modal-close').addEventListener('click', () => closeModal('city-modal'));
    document.getElementById('city-search-submit').addEventListener('click', searchCityManual);
    document.getElementById('city-search-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchCityManual();
    });
    document.getElementById('use-gps-link').addEventListener('click', (e) => {
      e.preventDefault();
      closeModal('city-modal');
      requestUserLocation(true);
    });

    // Настройки расчетов шариата
    document.getElementById('tool-shariah-config').addEventListener('click', () => {
      document.getElementById('calculation-method-select').value = state.calculationMethod;
      document.getElementById('asr-method-select').value = state.asrMethod;
      openModal('settings-modal');
    });
    document.getElementById('settings-modal-close').addEventListener('click', () => closeModal('settings-modal'));
    document.getElementById('save-settings-btn').addEventListener('click', saveCalculationSettings);

    // Ночной режим (плитка)
    document.getElementById('tool-theme-toggle').addEventListener('click', toggleTheme);

    // Плитка Компаса
    document.getElementById('tool-compass-link').addEventListener('click', () => {
      document.getElementById('qibla-section').scrollIntoView({ behavior: 'smooth' });
    });

    // Плитка Календаря
    document.getElementById('tool-hijri-link').addEventListener('click', () => {
      alert(`Сегодня: ${state.gregorianDate}\nПо Хиджре: ${state.hijriDate}`);
    });

    // Кнопка Дуа
    document.getElementById('dua-banner-btn').addEventListener('click', () => {
      alert('Это дуа «Раббана атина...» — одна из самых частых и всеобъемлющих молитв в исламе, содержащаяся в суре Аль-Бакара (аят 201).');
    });

    // Коран: изменение размера шрифта
    const fontRange = document.getElementById('quran-font-range');
    fontRange.value = state.fontSize;
    fontRange.addEventListener('input', (e) => {
      state.fontSize = parseInt(e.target.value);
      localStorage.setItem('mazhab_font_size', state.fontSize);
      document.querySelectorAll('.verse-arabic').forEach(el => {
        el.style.fontSize = `${state.fontSize}px`;
      });
    });

    // Выбор чтеца
    document.getElementById('reciter-select').addEventListener('change', (e) => {
      state.reciter = e.target.value;
      loadSurahContent(state.selectedSurah);
    });

    // Поиск суры в сайдбаре
    document.getElementById('surah-search-input').addEventListener('input', filterSurahList);
  }

  function openModal(id) {
    document.getElementById(id).classList.add('active');
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('active');
  }

  /* ----------------------------------------------------
     ГЕОЛОКАЦИЯ И КООРДИНАТЫ
     ---------------------------------------------------- */
  function requestUserLocation(force = false) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          state.coords.lat = position.coords.latitude;
          state.coords.lng = position.coords.longitude;
          localStorage.setItem('mazhab_lat', state.coords.lat);
          localStorage.setItem('mazhab_lng', state.coords.lng);
          
          fetchCityName(state.coords.lat, state.coords.lng);
          updateQiblaCalculation();
          fetchPrayerTimes();
        },
        (error) => {
          console.warn('Геолокация недоступна:', error.message);
          if (force) {
            alert('Не удалось получить доступ к GPS. Пожалуйста, выберите город вручную.');
          } else {
            updateQiblaCalculation();
            fetchPrayerTimes();
          }
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      updateQiblaCalculation();
      fetchPrayerTimes();
    }
  }

  function fetchCityName(lat, lng) {
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ru`)
      .then(res => res.json())
      .then(data => {
        const city = data.address.city || data.address.town || data.address.village || data.address.county || 'Мое местоположение';
        state.cityName = city;
        localStorage.setItem('mazhab_city', city);
        document.getElementById('hero-city').textContent = city.toUpperCase();
        document.getElementById('panel-city-name').textContent = city;
      })
      .catch(err => {
        console.error('Ошибка получения названия города:', err);
      });
  }

  function searchCityManual() {
    const query = document.getElementById('city-search-input').value.trim();
    if (!query) return;

    const resultsDiv = document.getElementById('city-search-results');
    resultsDiv.innerHTML = '<div style="padding: 10px; font-size:13px; color:var(--color-text-muted);">Поиск...</div>';

    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=ru`)
      .then(res => res.json())
      .then(data => {
        resultsDiv.innerHTML = '';
        if (data.length === 0) {
          resultsDiv.innerHTML = '<div style="padding:10px; font-size:13px; color:red;">Город не найден</div>';
          return;
        }

        data.forEach(item => {
          const btn = document.createElement('div');
          btn.className = 'search-result-item';
          btn.textContent = item.display_name;
          btn.addEventListener('click', () => {
            state.coords.lat = parseFloat(item.lat);
            state.coords.lng = parseFloat(item.lon);
            const parts = item.display_name.split(',');
            state.cityName = parts[0].trim();

            localStorage.setItem('mazhab_lat', state.coords.lat);
            localStorage.setItem('mazhab_lng', state.coords.lng);
            localStorage.setItem('mazhab_city', state.cityName);

            document.getElementById('hero-city').textContent = state.cityName.toUpperCase();
            document.getElementById('panel-city-name').textContent = state.cityName;

            updateQiblaCalculation();
            fetchPrayerTimes();
            closeModal('city-modal');
          });
          resultsDiv.appendChild(btn);
        });
      })
      .catch(err => {
        console.error('Ошибка поиска города:', err);
        resultsDiv.innerHTML = '<div style="padding:10px; font-size:13px; color:red;">Ошибка поиска</div>';
      });
  }

  function saveCalculationSettings() {
    state.calculationMethod = document.getElementById('calculation-method-select').value;
    state.asrMethod = document.getElementById('asr-method-select').value;
    
    localStorage.setItem('mazhab_method', state.calculationMethod);
    localStorage.setItem('mazhab_asr', state.asrMethod);
    
    fetchPrayerTimes();
    closeModal('settings-modal');
  }

  /* ----------------------------------------------------
     РАСЧЕТ ВРЕМЕНИ НАМАЗА И ТАЙМЕР
     ---------------------------------------------------- */
  function fetchPrayerTimes() {
    const timestamp = Math.floor(Date.now() / 1000);
    const url = `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${state.coords.lat}&longitude=${state.coords.lng}&method=${state.calculationMethod}&school=${state.asrMethod}`;

    fetch(url)
      .then(res => res.json())
      .then(resData => {
        if (resData.code === 200 && resData.data) {
          const d = resData.data;
          state.prayerTimings = d.timings;
          
          // Месяцы Хиджры
          const hijriMonthsRu = {
            'Al-Muharram': 'Мухаррам', 'Safar': 'Сафар', 'Rabi\' al-awwal': 'Раби аль-авваль', 
            'Rabi\' al-thani': 'Раби ас-сани', 'Jumada al-ula': 'Джумада аль-уля', 
            'Jumada al-akhirah': 'Джумада аль-ахира', 'Rajab': 'Раджаб', 'Sha\'ban': 'Шаабан', 
            'Ramadan': 'Рамадан', 'Shawwal': 'Шавваль', 'Dhu al-Qa\'dah': 'Зуль-Када', 
            'Dhu al-Hijjah': 'Зуль-Хиджа'
          };
          const rawMonth = d.date.hijri.month.en;
          const monthRu = hijriMonthsRu[rawMonth] || rawMonth;
          state.hijriDate = `${d.date.hijri.day} ${monthRu} ${d.date.hijri.year} г.х.`;

          // Григорианская дата
          const dateObj = new Date();
          const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
          state.gregorianDate = dateObj.toLocaleDateString('ru-RU', options);
          state.gregorianDate = state.gregorianDate.charAt(0).toUpperCase() + state.gregorianDate.slice(1);

          updatePrayerUI();
          initMap();
        }
      })
      .catch(err => {
        console.error('Ошибка загрузки времени намазов:', err);
      });
  }

  function updatePrayerUI() {
    if (!state.prayerTimings) return;

    const timings = state.prayerTimings;

    document.getElementById('hero-gregorian-date').textContent = state.gregorianDate.replace(', 2026', '').toUpperCase();
    document.getElementById('hero-hijri-date').textContent = state.hijriDate.toUpperCase();
    document.getElementById('panel-hijri-date').textContent = state.hijriDate;
    document.getElementById('panel-gregorian-date').textContent = state.gregorianDate;
    document.getElementById('hero-city').textContent = state.cityName.toUpperCase();
    document.getElementById('panel-city-name').textContent = state.cityName;

    const prayerKeys = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    prayerKeys.forEach(key => {
      const timeVal = timings[key];
      const cell = document.getElementById(`time-${key.toLowerCase()}`);
      if (cell) cell.textContent = timeVal;
      
      const arcCell = document.getElementById(`arc-time-${key.toLowerCase()}`);
      if (arcCell) arcCell.textContent = timeVal;
    });

    runClockLogic();
  }

  function runClockLogic() {
    if (window.clockTimerId) clearInterval(window.clockTimerId);

    function tick() {
      if (!state.prayerTimings) return;
      
      const now = new Date();
      const timings = state.prayerTimings;
      
      const parseTime = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
      };

      const times = {
        fajr: parseTime(timings.Fajr),
        sunrise: parseTime(timings.Sunrise),
        dhuhr: parseTime(timings.Dhuhr),
        asr: parseTime(timings.Asr),
        maghrib: parseTime(timings.Maghrib),
        isha: parseTime(timings.Isha)
      };

      let currentPrayer = '';
      let nextPrayer = '';
      let nextPrayerTime = null;
      let prevPrayerTime = null;

      if (now < times.fajr) {
        currentPrayer = 'Иша (ночной)';
        nextPrayer = 'ФАДЖР';
        nextPrayerTime = times.fajr;
        const yesterdayIsha = new Date(times.isha);
        yesterdayIsha.setDate(yesterdayIsha.getDate() - 1);
        prevPrayerTime = yesterdayIsha;
      } else if (now < times.sunrise) {
        currentPrayer = 'Фаджр';
        nextPrayer = 'ВОСХОД';
        nextPrayerTime = times.sunrise;
        prevPrayerTime = times.fajr;
      } else if (now < times.dhuhr) {
        currentPrayer = 'Восход';
        nextPrayer = 'ЗУХР';
        nextPrayerTime = times.dhuhr;
        prevPrayerTime = times.sunrise;
      } else if (now < times.asr) {
        currentPrayer = 'Зухр';
        nextPrayer = 'АСР';
        nextPrayerTime = times.asr;
        prevPrayerTime = times.dhuhr;
      } else if (now < times.maghrib) {
        currentPrayer = 'Аср';
        nextPrayer = 'МАГРИБ';
        nextPrayerTime = times.maghrib;
        prevPrayerTime = times.asr;
      } else if (now < times.isha) {
        currentPrayer = 'Магриб';
        nextPrayer = 'ИША';
        nextPrayerTime = times.isha;
        prevPrayerTime = times.maghrib;
      } else {
        currentPrayer = 'Иша';
        const tomorrowFajr = new Date(times.fajr);
        tomorrowFajr.setDate(tomorrowFajr.getDate() + 1);
        nextPrayer = 'ФАДЖР (завтра)';
        nextPrayerTime = tomorrowFajr;
        prevPrayerTime = times.isha;
      }

      const diffMs = nextPrayerTime - now;
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);

      const formatNum = (n) => String(n).padStart(2, '0');
      document.getElementById('countdown-timer-text').textContent = `${formatNum(hours)}:${formatNum(minutes)}:${formatNum(seconds)}`;
      document.getElementById('countdown-label').textContent = `ДО НАМАЗА ${nextPrayer}`;

      let statusText = '';
      if (currentPrayer === 'Аср') {
        statusText = `Аср завершится в ${timings.Maghrib} | Заход солнца - ${timings.Maghrib}`;
      } else if (currentPrayer === 'Зухр') {
        statusText = `Зухр завершится в ${timings.Asr} | Время Асра - ${timings.Asr}`;
      } else if (currentPrayer === 'Магриб') {
        statusText = `Магриб завершится в ${timings.Isha} | Время Иша - ${timings.Isha}`;
      } else if (currentPrayer === 'Фаджр') {
        statusText = `Фаджр завершится в ${timings.Sunrise} | Восход солнца - ${timings.Sunrise}`;
      } else {
        statusText = `Текущий намаз: ${currentPrayer}`;
      }
      document.getElementById('countdown-status-text').innerHTML = statusText;

      const cssIdMap = {
        'Фаджр': 'item-fajr',
        'Восход': 'item-sunrise',
        'Зухр': 'item-dhuhr',
        'Аср': 'item-asr',
        'Магриб': 'item-maghrib',
        'Иша': 'item-isha',
        'Иша (ночной)': 'item-isha'
      };
      
      document.querySelectorAll('.prayer-item').forEach(el => el.classList.remove('active-prayer'));
      const activeRowId = cssIdMap[currentPrayer];
      if (activeRowId) {
        document.getElementById(activeRowId).classList.add('active-prayer');
      }

      document.getElementById('active-prayer-name').textContent = `${currentPrayer.toUpperCase()} · СЕЙЧАС`;
      const timeValNode = document.getElementById(`time-${activeRowId?.replace('item-', '')}`);
      if (timeValNode) {
        document.getElementById('arc-time-current').textContent = timeValNode.textContent;
      }

      // Движение солнца по SVG-дуге
      let sunPercent = 0;
      if (now >= times.fajr && now <= times.maghrib) {
        const dayTotalMs = times.maghrib - times.fajr;
        const dayPassedMs = now - times.fajr;
        sunPercent = dayPassedMs / dayTotalMs;
      } else if (now > times.maghrib) {
        sunPercent = 1;
      } else {
        sunPercent = 0;
      }

      const startAngle = Math.PI;
      const endAngle = 0;
      const currentAngle = startAngle - (sunPercent * (startAngle - endAngle));
      
      const rx = 350;
      const ry = 160;
      const cx = 400;
      const cy = 200;

      const sunX = cx + rx * Math.cos(currentAngle);
      const sunY = cy - ry * Math.sin(currentAngle);

      const sunDot = document.getElementById('dynamic-sun');
      if (sunDot) {
        sunDot.setAttribute('cx', sunX);
        sunDot.setAttribute('cy', sunY);
      }
    }

    tick();
    window.clockTimerId = setInterval(tick, 1000);
  }

  /* ----------------------------------------------------
     КИБЛА (РАСЧЕТЫ И СЕНСОРЫ)
     ---------------------------------------------------- */
  function updateQiblaCalculation() {
    const latU = state.coords.lat * Math.PI / 180;
    const lngU = state.coords.lng * Math.PI / 180;
    const latM = MECCA_COORDS.lat * Math.PI / 180;
    const lngM = MECCA_COORDS.lng * Math.PI / 180;

    const dLng = lngM - lngU;
    const y = Math.sin(dLng) * Math.cos(latM);
    const x = Math.cos(latU) * Math.sin(latM) - Math.sin(latU) * Math.cos(latM) * Math.cos(dLng);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360;
    
    state.qiblaAngle = Math.round(bearing);

    const R = 6371;
    const dLat = latM - latU;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(latU) * Math.cos(latM) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    state.qiblaDistance = Math.round(R * c);

    document.getElementById('qibla-val-angle').textContent = `${state.qiblaAngle}°`;
    document.getElementById('qibla-val-distance').textContent = `${state.qiblaDistance.toLocaleString('ru-RU')} км`;
    document.getElementById('qibla-angle-btn').textContent = `${state.qiblaAngle}°`;
    document.getElementById('qibla-dist-btn').textContent = `${state.qiblaDistance.toLocaleString('ru-RU')} км`;

    document.getElementById('panel-dial-arrow').style.transform = `rotate(${state.qiblaAngle}deg)`;

    rotateNeedle();
  }

  function rotateNeedle() {
    const needle = document.getElementById('compass-needle-element');
    // Стрелка ВНЕ диска — вращается самостоятельно
    // qiblaAngle = азимут Киблы от севера (например 244°)
    // deviceHeading = куда смотрит телефон от севера (0-360)
    // Разница = на сколько градусов Кибла правее/левее от текущего направления телефона
    const rotation = state.qiblaAngle - state.deviceHeading;
    if (needle) {
      needle.style.transform = `rotate(${rotation}deg)`;
    }
    // Отладка — показать значения на экране
    const debugEl = document.getElementById('compass-debug');
    if (debugEl) {
      debugEl.textContent = `Азимут Киблы: ${state.qiblaAngle}° | Телефон: ${state.deviceHeading}° | Стрелка: ${Math.round(rotation)}°`;
    }
  }

  function handleOrientation(event) {
    let heading = null;

    if (event.webkitCompassHeading !== undefined) {
      // iOS — webkitCompassHeading уже даёт градусы от магнитного севера
      heading = event.webkitCompassHeading;
    } else if (event.alpha !== null) {
      // Android — alpha это угол вращения вокруг оси Z
      // Для абсолютного события alpha = азимут
      if (event.absolute) {
        heading = (360 - event.alpha) % 360;
      } else {
        // Относительный — тоже используем, лучше чем ничего
        heading = (360 - event.alpha) % 360;
      }
    }

    if (heading !== null) {
      state.deviceHeading = Math.round(heading);
      
      // Вращаем диск (буквы С, В, Ю, З) чтобы "С" всегда смотрел на реальный север
      const dial = document.getElementById('compass-dial-element');
      if (dial) {
        dial.style.transform = `rotate(${-state.deviceHeading}deg)`;
      }
      rotateNeedle();
    }
  }

  async function requestCompassPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permissionState = await DeviceOrientationEvent.requestPermission();
        if (permissionState === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, true);
          document.getElementById('enable-compass-btn').style.display = 'none';
        } else {
          alert('Доступ к датчикам отклонен. Используйте карту для определения направления.');
        }
      } catch (error) {
        console.error('Ошибка запроса датчиков:', error);
      }
    }
  }

  /* ----------------------------------------------------
     КАРТА (LEAFLET.JS)
     ---------------------------------------------------- */
  function initMap() {
    const mapDiv = document.getElementById('qibla-map');
    if (!mapDiv) return;

    const userLatLng = [state.coords.lat, state.coords.lng];
    const meccaLatLng = [MECCA_COORDS.lat, MECCA_COORDS.lng];

    if (!state.mapInstance) {
      state.mapInstance = L.map('qibla-map', {
        scrollWheelZoom: false
      }).setView(userLatLng, 4);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CartoDB'
      }).addTo(state.mapInstance);

      const goldIcon = L.divIcon({
        className: 'custom-map-icon',
        html: '<div style="background-color: var(--color-gold); width: 14px; height: 14px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 10px rgba(0,0,0,0.3)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const userIcon = L.divIcon({
        className: 'custom-map-icon-user',
        html: '<div style="background-color: var(--color-emerald); width: 12px; height: 12px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 10px rgba(0,0,0,0.3)"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      state.mapUserMarker = L.marker(userLatLng, { icon: userIcon }).addTo(state.mapInstance)
        .bindPopup(`<b>Вы здесь:</b> ${state.cityName}`);
      
      state.mapMeccaMarker = L.marker(meccaLatLng, { icon: goldIcon }).addTo(state.mapInstance)
        .bindPopup('<b>Кааба (Мекка)</b>');

      state.mapPolyline = L.polyline([userLatLng, meccaLatLng], {
        color: '#cda052',
        weight: 3,
        opacity: 0.8,
        dashArray: '6, 6'
      }).addTo(state.mapInstance);
      
      const bounds = L.latLngBounds([userLatLng, meccaLatLng]);
      state.mapInstance.fitBounds(bounds, { padding: [40, 40] });
    } else {
      state.mapUserMarker.setLatLng(userLatLng).getPopup().setContent(`<b>Вы здесь:</b> ${state.cityName}`);
      state.mapPolyline.setLatLngs([userLatLng, meccaLatLng]);
      
      const bounds = L.latLngBounds([userLatLng, meccaLatLng]);
      state.mapInstance.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  /* ----------------------------------------------------
     КОРАН (ПОЛУЧЕНИЕ И ОТОБРАЖЕНИЕ)
     ---------------------------------------------------- */
  function loadSurahList() {
    fetch('https://api.alquran.cloud/v1/surah')
      .then(res => res.json())
      .then(resData => {
        if (resData.code === 200 && resData.data) {
          state.surahList = resData.data;
          renderSurahListInSidebar();
        }
      })
      .catch(err => {
        console.error('Ошибка загрузки списка сур:', err);
      });
  }

  function renderSurahListInSidebar() {
    const listUl = document.getElementById('surah-list-ul');
    listUl.innerHTML = '';

    state.surahList.forEach(surah => {
      const li = document.createElement('li');
      li.className = 'surah-item';
      if (surah.number === state.selectedSurah) {
        li.classList.add('active-surah');
      }
      li.setAttribute('data-surah-id', surah.number);

      li.innerHTML = `
        <span class="surah-number">${surah.number}</span>
        <div class="surah-names">
          <span class="surah-name-ru">${surah.englishName}</span>
          <span class="surah-name-ar">${surah.name}</span>
        </div>
      `;

      li.addEventListener('click', () => {
        document.querySelectorAll('.surah-item').forEach(el => el.classList.remove('active-surah'));
        li.classList.add('active-surah');
        
        state.selectedSurah = surah.number;
        loadSurahContent(surah.number);
      });

      listUl.appendChild(li);
    });
  }

  function filterSurahList(e) {
    const query = e.target.value.toLowerCase().trim();
    const items = document.querySelectorAll('.surah-item');
    
    items.forEach(item => {
      const nameRu = item.querySelector('.surah-name-ru').textContent.toLowerCase();
      const num = item.querySelector('.surah-number').textContent;
      
      if (nameRu.includes(query) || num.includes(query)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  function loadSurahContent(surahId) {
    const versesContainer = document.getElementById('verses-container');
    versesContainer.innerHTML = '<div style="padding:40px; text-align:center; color:var(--color-text-muted);">Загрузка суры...</div>';
    
    stopAudio();

    const url = `https://api.alquran.cloud/v1/surah/${surahId}/editions/quran-simple-plain,ru.kuliev,${state.reciter}`;

    fetch(url)
      .then(res => res.json())
      .then(resData => {
        if (resData.code === 200 && resData.data) {
          const arabicData = resData.data[0];
          const translationData = resData.data[1];
          const audioData = resData.data[2];

          state.currentSurahVerses = arabicData.ayahs.map((ayah, i) => {
            return {
              numberInSurah: ayah.numberInSurah,
              arabicText: ayah.text,
              translation: translationData.ayahs[i].text,
              audio: audioData.ayahs[i].audio
            };
          });

          renderSurahVerses(arabicData.englishName, arabicData.name, arabicData.numberOfAyahs);
          
          state.audioUrls = state.currentSurahVerses.map(v => v.audio);
          state.currentAyahIndex = 0;
          updateAudioPlayerBarState();
        }
      })
      .catch(err => {
        console.error('Ошибка загрузки контента суры:', err);
        versesContainer.innerHTML = '<div style="padding:40px; text-align:center; color:red;">Не удалось загрузить суру. Проверьте интернет.</div>';
      });
  }

  function renderSurahVerses(nameEng, nameAr, numAyahs) {
    document.getElementById('current-surah-title').textContent = `${nameEng} · аяты 1–${numAyahs}`;
    document.getElementById('current-surah-title-ar').textContent = nameAr;

    const bismillahBanner = document.getElementById('bismillah-banner');
    if (state.selectedSurah === 1 || state.selectedSurah === 9) {
      bismillahBanner.style.display = 'none';
    } else {
      bismillahBanner.style.display = 'block';
    }

    const container = document.getElementById('verses-container');
    container.innerHTML = '';

    state.currentSurahVerses.forEach((verse, i) => {
      let arabicTextClean = verse.arabicText;
      if (state.selectedSurah !== 1 && verse.numberInSurah === 1) {
        arabicTextClean = arabicTextClean.replace('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', '').trim();
      }

      const block = document.createElement('div');
      block.className = 'verse-block';
      block.setAttribute('data-verse-idx', i);

      block.innerHTML = `
        <div class="verse-arabic" style="font-size: ${state.fontSize}px;">
          ${arabicTextClean} <span>﴿${verse.numberInSurah}﴾</span>
        </div>
        <div class="verse-translation">
          <span class="verse-num-label">${verse.numberInSurah}.</span> ${verse.translation}
        </div>
      `;

      block.addEventListener('click', () => {
        playAyah(i);
      });

      container.appendChild(block);
    });
  }

  /* ----------------------------------------------------
     АУДИОПЛЕЕР КОРАНА
     ---------------------------------------------------- */
  const audioEl = document.getElementById('quran-audio-element');

  function initAudioPlayerListeners() {
    const playPauseBtn = document.getElementById('audio-play-pause-btn');
    playPauseBtn.addEventListener('click', toggleAudioPlayback);

    audioEl.addEventListener('ended', () => {
      if (state.currentAyahIndex < state.audioUrls.length - 1) {
        playAyah(state.currentAyahIndex + 1);
      } else {
        stopAudio();
      }
    });

    audioEl.addEventListener('timeupdate', () => {
      if (audioEl.duration) {
        const percent = (audioEl.currentTime / audioEl.duration) * 100;
        document.getElementById('audio-progress-bar-fill').style.width = `${percent}%`;
        document.getElementById('audio-current-time').textContent = formatAudioTime(audioEl.currentTime);
        document.getElementById('audio-total-time').textContent = formatAudioTime(audioEl.duration);
      }
    });

    document.querySelector('.audio-progress-bar-wrapper').addEventListener('click', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const percent = clickX / width;
      if (audioEl.duration) {
        audioEl.currentTime = percent * audioEl.duration;
      }
    });
  }

  function playAyah(idx) {
    if (idx < 0 || idx >= state.audioUrls.length) return;

    state.currentAyahIndex = idx;
    const url = state.audioUrls[idx];
    audioEl.src = url;
    
    highlightActiveVerseBlock(idx);

    audioEl.play()
      .then(() => {
        state.audioPlaying = true;
        updateAudioPlayerBarState();
      })
      .catch(err => {
        console.error('Ошибка воспроизведения аудио:', err);
      });
  }

  function toggleAudioPlayback() {
    if (state.audioPlaying) {
      audioEl.pause();
      state.audioPlaying = false;
    } else {
      if (!audioEl.src) {
        playAyah(0);
        return;
      }
      audioEl.play();
      state.audioPlaying = true;
    }
    updateAudioPlayerBarState();
  }

  function stopAudio() {
    audioEl.pause();
    audioEl.src = '';
    state.audioPlaying = false;
    state.currentAyahIndex = 0;
    updateAudioPlayerBarState();
    removeVerseHighlights();
  }

  function highlightActiveVerseBlock(idx) {
    removeVerseHighlights();
    const activeBlock = document.querySelector(`.verse-block[data-verse-idx="${idx}"]`);
    if (activeBlock) {
      activeBlock.style.backgroundColor = 'rgba(205, 160, 82, 0.08)';
      activeBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function removeVerseHighlights() {
    document.querySelectorAll('.verse-block').forEach(el => {
      el.style.backgroundColor = 'transparent';
    });
  }

  function updateAudioPlayerBarState() {
    const playIconSym = document.getElementById('play-icon-sym');
    const statusLabel = document.getElementById('audio-status-label');

    if (state.audioPlaying) {
      playIconSym.textContent = '⏸';
      const currentAyah = state.currentSurahVerses[state.currentAyahIndex];
      statusLabel.textContent = `Аят ${currentAyah ? currentAyah.numberInSurah : 1}`;
    } else {
      playIconSym.textContent = '▶';
      statusLabel.textContent = audioEl.src ? 'Пауза' : 'Аудио: Выключено';
    }
  }

  function formatAudioTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /* ----------------------------------------------------
     ДАННЫЕ ДЛЯ РАЗДЕЛА ОБУЧЕНИЯ
     ---------------------------------------------------- */
  const wuduSteps = [
    {
      title: 'Намерение (Ният) и Басмала',
      desc: 'Мысленно выразите намерение совершить малое омовение ради Аллаха и скажите: «Бисмилляхи-р-Рахмани-р-Рахим» (Во имя Аллаха, Милостивого, Милосердного).',
      arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
      trans: 'Бисмилляхи-р-Рахмани-р-Рахим',
      transRu: 'Во имя Аллаха, Милостивого, Милосердного.'
    },
    {
      title: 'Мытье кистей рук',
      desc: 'Трижды вымойте кисти рук до запястий, тщательно промывая промежутки между пальцами.',
      arabic: '',
      trans: '',
      transRu: ''
    },
    {
      title: 'Полоскание рта',
      desc: 'Трижды наберите воду правой рукой в рот, тщательно прополощите его и выплюньте.',
      arabic: '',
      trans: '',
      transRu: ''
    },
    {
      title: 'Промывание носа',
      desc: 'Правой рукой наберите воду в нос и втяните её, а левой рукой высморкайтесь. Повторите три раза.',
      arabic: '',
      trans: '',
      transRu: ''
    },
    {
      title: 'Мытье лица',
      desc: 'Трижды вымойте лицо обеими руками — от границы роста волос на лбу до подбородка, и от одного мочка уха до другого.',
      arabic: '',
      trans: '',
      transRu: ''
    },
    {
      title: 'Мытье рук до локтей',
      desc: 'Вымойте трижды правую руку до локтя включительно, затем левую руку аналогичным образом.',
      arabic: '',
      trans: '',
      transRu: ''
    },
    {
      title: 'Протирание головы (Масх) и ушей',
      desc: 'Влажными ладонями проведите по голове от лба к затылку и обратно (1 раз). Затем указательными пальцами протрите уши изнутри, а большими — снаружи.',
      arabic: '',
      trans: '',
      transRu: ''
    },
    {
      title: 'Мытье ног',
      desc: 'Трижды вымойте правую ногу до щиколоток включительно, тщательно промывая пальцы мизинцем левой руки. Затем аналогично вымойте левую ногу.',
      arabic: '',
      trans: '',
      transRu: ''
    },
    {
      title: 'Свидетельство (Дуа после омовения)',
      desc: 'Повернитесь лицом к Кибле и произнесите свидетельство веры (Шахаду).',
      arabic: 'أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ',
      trans: 'Ашхаду алля иляха илляллаху вахдаху ля шарика ляху, ва ашхаду анна Мухаммадан ‘абдуху ва расулюх.',
      transRu: '«Свидетельствую, что нет божества, кроме Аллаха, Единственного, у Которого нет сотоварища, и свидетельствую, что Мухаммад — Его раб и посланник».'
    }
  ];

  const namazSteps = [
    {
      title: 'Намерение (Ният)',
      desc: 'Встаньте лицом к Кибле. Сделайте мысленное намерение на совершение молитвы (например, 2 ракаата обязательного утреннего намаза Фаджр). Взгляд направьте на место совершения земного поклона (суджуда).',
      arabic: '',
      trans: '',
      transRu: ''
    },
    {
      title: 'Вступительный такбир',
      descMale: 'Поднимите руки так, чтобы большие пальцы касались мочек ушей (ладони направлены к Кибле), и произнесите: «Аллаху Акбар» (Аллах Велик).',
      descFemale: 'Поднимите руки так, чтобы кончики пальцев были на уровне плеч (ладони направлены к Кибле), и произнесите: «Аллаху Акбар» (Аллах Велик).',
      arabic: 'اللَّهُ أَكْبَرُ',
      trans: 'Алла́ху А́кбар',
      transRu: '«Аллах Велик».'
    },
    {
      title: 'Стояние (Кыям) и чтение Корана',
      descMale: 'Опустите руки на живот чуть ниже пупка (правая рука ложится поверх левой, обхватывая запястье). Прочтите дуа «Сана», затем суру «Аль-Фатиха» и короткую суру (например, «Аль-Ихляс»).',
      descFemale: 'Сложите руки на груди (правая рука ложится поверх левой на уровне грудной клетки). Прочтите дуа «Сана», затем суру «Аль-Фатиха» и короткую суру (например, «Аль-Ихляс»).',
      arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ✦ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ...',
      trans: 'Бисмилляхи-р-Рахмани-р-Рахим ✦ Аль-хамду лилляхи раббиль-‘алямин...',
      transRu: '«С именем Аллаха, Милостивого, Милосердного ✦ Хвала Аллаху, Господу миров...»'
    },
    {
      title: 'Поясной поклон (Руку)',
      descMale: 'Со словами «Аллаху Акбар» наклонитесь вперед. Спина должна быть параллельна полу, пальцы рук обхватывают колени. Произнесите 3 раза: «Субхана Раббийаль-Азым» (Пречист мой Великий Господь).',
      descFemale: 'Со словами «Аллаху Акбар» сделайте неглубокий наклон. Руки положите на колени (пальцы сжаты). Спина не обязательно должна быть строго параллельна полу. Произнесите 3 раза: «Субхана Раббийаль-Азым».',
      arabic: 'سُبْحَانَ رَبِّيَ الْعَظِيمِ',
      trans: 'Субха́на Рабби́йаль-‘Азы́м (3 раза)',
      transRu: '«Пречист мой Великий Господь».'
    },
    {
      title: 'Выпрямление (Кавма)',
      desc: 'Выпрямитесь со словами: «Сами‘а-Ллаху лиман хамидах» (Слышит Аллах тех, кто Его хвалит). Встав прямо, опустите руки вдоль тела и произнесите: «Раббана лякаль-хамд» (Господь наш, Тебе хвала).',
      arabic: 'سَمِعَ اللَّهُ لِمَنْ حَمِدَهُ ✦ رَبَّنَا وَلَكَ الْحَمْدُ',
      trans: 'Сами‘а-Лла́ху лима́н хами́дах ✦ Раббана́ ва ляка́ль-хамд',
      transRu: '«Слышит Аллах тех, кто Его хвалит» ✦ «Господь наш, Тебе вся хвала».'
    },
    {
      title: 'Земной поклон (Саджда)',
      descMale: 'Со словами «Аллаху Акбар» опуститесь на колени, затем на ладони и коснитесь пола носом и лбом. Локти приподняты над полом и разведены в стороны, живот не касается бедер. Произнесите 3 раза: «Субхана Раббийаль-А‘ля» (Пречист мой Всевышний Господь).',
      descFemale: 'Со словами «Аллаху Акбар» опуститесь в земной поклон. Прижмите локти к бокам, а живот — к бедрам. Произнесите 3 раза: «Субхана Раббийаль-А‘ля» (Пречист мой Всевышний Господь).',
      arabic: 'سُبْحَانَ رَبِّيَ الْأَعْلَى',
      trans: 'Субха́на Рабби́йаль-А‘ля́ (3 раза)',
      transRu: '«Пречист мой Всевышний Господь».'
    },
    {
      title: 'Сидение между поклонами (Джальса)',
      descMale: 'Со словами «Аллаху Акбар» приподнимитесь и сядьте на левую ногу, направив пальцы правой ноги в сторону Киблы. Руки положите на бедра. Произнесите краткое дуа о прощении: «Рабби-гфир ли» (Господи, прости меня).',
      descFemale: 'Со словами «Аллаху Акбар» приподнимитесь и сядьте, подогнув ноги под себя вправо (сидя на левом бедре). Руки положите на бедра. Произнесите: «Рабби-гфир ли».',
      arabic: 'رَبِّ اغْفِرْ لِي',
      trans: 'Рабби-гфир ли',
      transRu: '«Господи, прости меня».'
    },
    {
      title: 'Второй земной поклон',
      desc: 'Со словами «Аллаху Акбар» снова опуститесь во второй земной поклон и повторите 3 раза: «Субхана Раббийаль-А‘ля». На этом завершается первый ракаат.',
      arabic: 'سُبْحَانَ رَبِّيَ الْأَعْلَى',
      trans: 'Субха́на Рабби́йаль-А‘ля́ (3 раза)',
      transRu: '«Пречист мой Всевышний Господь».'
    },
    {
      title: 'Второй ракаат, Ташаххуд и Салям',
      descMale: 'Встаньте со словами «Аллаху Акбар» во второй ракаат и повторите все действия (Кыям, Руку, Суджуд). Затем сядьте и прочтите молитвы «Ат-Тахийят», «Салават» и дуа. После этого поверните голову направо со словами приветствия, затем налево.',
      descFemale: 'Встаньте во второй ракаат со словами «Аллаху Акбар» и повторите все действия. В конце сядьте, поджав ноги под себя вправо, прочтите «Ат-Тахийят», «Салават» и отдайте приветствие (Салям) направо и налево.',
      arabic: 'التَّحِيَّاتُ لِلَّهِ... ✦ السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ',
      trans: 'Ат-тахийя́ту лилля́хи... ✦ Ассаля́му ‘алейку́м ва рахматулла́х',
      transRu: '«Приветствия Аллаху...» ✦ «Мир вам и милость Аллаха».'
    }
  ];

  /* ----------------------------------------------------
     ЛОГИКА ОБУЧЕНИЯ
     ---------------------------------------------------- */
  function initLearningSection() {
    const btnNamaz = document.getElementById('learn-mode-namaz');
    const btnWudu = document.getElementById('learn-mode-wudu');
    const btnMale = document.getElementById('learn-gender-male');
    const btnFemale = document.getElementById('learn-gender-female');
    const genderWrapper = document.getElementById('learning-gender-wrapper');

    const btnNext = document.getElementById('learn-next-btn');
    const btnPrev = document.getElementById('learn-prev-btn');

    // Переключение режимов (Омовение / Намаз)
    btnNamaz.addEventListener('click', () => {
      btnNamaz.classList.add('active');
      btnWudu.classList.remove('active');
      genderWrapper.style.display = 'flex';
      state.learnMode = 'namaz';
      state.learnStepIndex = 0;
      renderLearningStep();
    });

    btnWudu.addEventListener('click', () => {
      btnWudu.classList.add('active');
      btnNamaz.classList.remove('active');
      genderWrapper.style.display = 'none'; // У омовения нет разделения полов в инструкции
      state.learnMode = 'wudu';
      state.learnStepIndex = 0;
      renderLearningStep();
    });

    // Переключение полов
    btnMale.addEventListener('click', () => {
      btnMale.classList.add('active');
      btnFemale.classList.remove('active');
      state.learnGender = 'male';
      renderLearningStep();
    });

    btnFemale.addEventListener('click', () => {
      btnFemale.classList.add('active');
      btnMale.classList.remove('active');
      state.learnGender = 'female';
      renderLearningStep();
    });

    // Листание шагов
    btnNext.addEventListener('click', () => {
      const steps = state.learnMode === 'namaz' ? namazSteps : wuduSteps;
      if (state.learnStepIndex < steps.length - 1) {
        animateStepTransition(() => {
          state.learnStepIndex++;
          renderLearningStep();
        });
      }
    });

    btnPrev.addEventListener('click', () => {
      if (state.learnStepIndex > 0) {
        animateStepTransition(() => {
          state.learnStepIndex--;
          renderLearningStep();
        });
      }
    });

    // Первая отрисовка
    renderLearningStep();
  }

  function animateStepTransition(callback) {
    const cardBody = document.getElementById('learn-card-body-content');
    cardBody.classList.add('fade-out');
    setTimeout(() => {
      callback();
      cardBody.classList.remove('fade-out');
    }, 300);
  }

  function renderLearningStep() {
    const steps = state.learnMode === 'namaz' ? namazSteps : wuduSteps;
    const step = steps[state.learnStepIndex];

    const indicator = document.getElementById('learn-step-indicator');
    const fill = document.getElementById('learn-progress-fill');
    const title = document.getElementById('learn-step-title');
    const desc = document.getElementById('learn-step-desc');
    const recBox = document.getElementById('learn-recitation-box');

    const btnNext = document.getElementById('learn-next-btn');
    const btnPrev = document.getElementById('learn-prev-btn');

    // Прогресс
    indicator.textContent = `Шаг ${state.learnStepIndex + 1} из ${steps.length}`;
    const percent = ((state.learnStepIndex + 1) / steps.length) * 100;
    fill.style.width = `${percent}%`;

    // Заголовок и Описание
    title.textContent = step.title;
    
    // Поддержка разделения полов
    if (state.learnMode === 'namaz') {
      if (state.learnGender === 'male' && step.descMale) {
        desc.textContent = step.descMale;
      } else if (state.learnGender === 'female' && step.descFemale) {
        desc.textContent = step.descFemale;
      } else {
        desc.textContent = step.desc;
      }
    } else {
      desc.textContent = step.desc;
    }

    // Молитва (арабский + транскрипция + перевод)
    if (step.arabic) {
      recBox.style.display = 'block';
      document.getElementById('learn-rec-arabic').textContent = step.arabic;
      document.getElementById('learn-rec-trans').textContent = step.trans;
      document.getElementById('learn-rec-trans-ru').textContent = step.transRu;
    } else {
      recBox.style.display = 'none';
    }

    // Состояние кнопок навигации
    btnPrev.disabled = state.learnStepIndex === 0;
    btnNext.disabled = state.learnStepIndex === steps.length - 1;
  }

  function initCompassDrag() {
    const container = document.getElementById('compass-dial-element');
    if (!container) return;

    // Drag доступен только если нет датчиков (на десктопе)
    // На телефоне датчики управляют компасом напрямую
    let hasSensors = false;
    
    function testSensor(e) {
      if (e.alpha !== null || e.webkitCompassHeading !== undefined) {
        hasSensors = true;
        // Удаляем тестовый обработчик
        window.removeEventListener('deviceorientation', testSensor);
        window.removeEventListener('deviceorientationabsolute', testSensor);
      }
    }
    window.addEventListener('deviceorientation', testSensor);
    window.addEventListener('deviceorientationabsolute', testSensor);

    let isDragging = false;
    let startAngle = 0;
    let currentRotation = 0;

    function getAngle(clientX, clientY) {
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return Math.atan2(clientY - centerY, clientX - centerX) * 180 / Math.PI;
    }

    function onStart(e) {
      if (hasSensors) return; // Не мешаем датчикам на телефоне
      isDragging = true;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startAngle = getAngle(clientX, clientY) - currentRotation;
      container.style.cursor = 'grabbing';
    }

    function onMove(e) {
      if (!isDragging) return;
      if (e.cancelable) e.preventDefault();
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      currentRotation = getAngle(clientX, clientY) - startAngle;
      
      // Симулируем heading из вращения
      state.deviceHeading = Math.round(((360 - currentRotation) % 360 + 360) % 360);

      container.style.transform = `rotate(${-state.deviceHeading}deg)`;
      rotateNeedle();
    }

    function onEnd() {
      isDragging = false;
      container.style.cursor = 'grab';
    }

    container.style.cursor = 'grab';
    
    // Mouse Events (для десктопа)
    container.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    // Touch Events (только если нет датчиков)
    container.addEventListener('touchstart', (e) => { if (!hasSensors) onStart(e); }, { passive: true });
    document.addEventListener('touchmove', (e) => { if (!hasSensors) onMove(e); }, { passive: false });
    document.addEventListener('touchend', (e) => { if (!hasSensors) onEnd(); });
  }

})();
