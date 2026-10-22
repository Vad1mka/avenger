(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const GUILD = '320325446342279168';
  const CHANNELS = {
    faces: '1197788579494121472',
    cooldown: '1071784599006478407',
    adult: '1071784599006478407',
    log: '648358700116869130'
  };
  const STORAGE_KEY = 'fc_discord_settings_v2';
  const BEASTS = new Set([
    'animal', 'capuchin', 'ape', 'orangutang', 'gorilla'
  ]);

  // Discord ID остаются строками: Number может потерять точность.
  function userId(value) {
    if (typeof value !== 'string') return '';
    const text = value.trim();
    const match = text.match(/^<@!?(\d{17,20})>$/);
    return match ? match[1] : /^\d{17,20}$/.test(text) ? text : '';
  }

  function mentions(value, allowRoles) {
    return value.trim().split(/[\s,;]+/).filter(Boolean).map(token => {
      const id = userId(token);
      if (id) return `<@${id}>`;
      if (allowRoles && /^<@&\d{17,20}>$/.test(token)) return token;
      throw new Error(
        `Неверное упоминание: ${token}. ` +
        'Пользователь: ID или <@ID>.' +
        (allowRoles ? ' Роль: <@&ID>.' : '')
      );
    }).join(' ');
  }

  function url(kind, web = false) {
    return (
      web ? 'https://discord.com/channels/' : 'discord://-/channels/'
    ) + GUILD + '/' + CHANNELS[kind];
  }

  function init() {
    if ($('fcDiscordTools')) return;

    const originalBuildFaces = window.buildFaces;
    if (typeof originalBuildFaces !== 'function' || !$('facesOut')) {
      console.error('FastCheck Discord: исходные элементы не найдены.');
      return;
    }

    let settings = { staff: '', curators: {} };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (saved && typeof saved === 'object') {
        settings.staff = typeof saved.staff === 'string' ? saved.staff : '';
        if (saved.curators && typeof saved.curators === 'object' &&
            !Array.isArray(saved.curators)) {
          settings.curators = saved.curators;
        }
      }
    } catch {
      // Настройки можно заполнить заново.
    }

    const panel = document.createElement('div');
    panel.id = 'fcDiscordTools';
    // Только постоянная разметка, без значений из базы.
    panel.innerHTML = `
      <hr style="border:0;border-top:1px solid var(--br);margin:16px 0">
      <h3>Быстрые действия Discord</h3>

      <label for="fcDiscordId">Discord ID игрока</label>
      <input id="fcDiscordId" autocomplete="off"
        placeholder="Из базы автоматически или вставь ID / <@ID>">

      <label for="fcHairColor">Натуральный цвет, если волосы окрашены</label>
      <input id="fcHairColor" placeholder="Необязательно, например: русый">

      <label for="fcHelpers">Помощники</label>
      <input id="fcHelpers" placeholder="ID или <@ID>, несколько через пробел">

      <details>
        <summary>Настройка упоминаний</summary>

        <label for="fcStaff">Ассистенты и Мл. Ассистенты</label>
        <input id="fcStaff" placeholder="<@ID_пользователя> или <@&ID_роли>">

        <label for="fcCuratorRole">Куратор для вида</label>
        <select id="fcCuratorRole">
          <option value="animal">animal</option>
          <option value="capuchin">capuchin</option>
          <option value="ape">ape</option>
          <option value="orangutang">orangutang</option>
          <option value="gorilla">gorilla</option>
        </select>

        <label for="fcCurator">Упоминание этого куратора</label>
        <input id="fcCurator" placeholder="<@ID> или <@&ID_роли>">

        <button type="button" id="fcSave" class="btn sec">
          Сохранить настройки
        </button>
      </details>

      <div class="fc-actions">
        <a class="btn sec" data-fc-kind="cooldown">Снять CoolDown</a>
        <a class="btn sec" data-fc-kind="adult">Запросить 18+</a>
        <a class="btn sec" data-fc-kind="log">Отпись о выпуске</a>
      </div>

      <label for="fcKind">Предпросмотр</label>
      <select id="fcKind">
        <option value="faces">Подпись фотографии</option>
        <option value="cooldown">Снять CoolDown</option>
        <option value="adult">Запросить 18+</option>
        <option value="log">Отпись о выпуске</option>
      </select>

      <textarea id="fcPreview" readonly
        style="margin-top:8px;min-height:85px"></textarea>

      <button type="button" id="fcCopy" class="btn sec">
        Только скопировать
      </button>

      <div class="fc-actions">
        <a id="fcApp" class="btn sec">Открыть Discord</a>
        <a id="fcWeb" class="btn sec" target="_blank" rel="noopener">
          Открыть в браузере
        </a>
      </div>

      <div id="fcNotice" role="status" aria-live="polite"
        style="margin-top:8px;font-size:13px"></div>
    `;
    $('facesOut').after(panel);

    const style = document.createElement('style');
    style.textContent = `
      #fcDiscordTools label {
        display:block;margin:10px 0 4px;font-size:13px;color:var(--muted)
      }
      #fcDiscordTools .fc-actions {
        display:flex;gap:8px;flex-wrap:wrap;margin-top:8px
      }
      #fcDiscordTools .fc-actions a {
        flex:1 1 130px;display:flex;align-items:center;
        justify-content:center;text-align:center;text-decoration:none;
        margin:0;cursor:pointer
      }
      #fcDiscordTools details[open] { max-height:none }
    `;
    document.head.appendChild(style);

    $('fcStaff').value = settings.staff;

    function notice(text, error = false) {
      $('fcNotice').textContent = text;
      $('fcNotice').style.color = error ? '#fca5a5' : '#86efac';
    }

    function curatorValue(role) {
      const value = settings.curators[role];
      return typeof value === 'string' ? value : '';
    }

    function rememberCurator() {
      settings.curators[$('fcCuratorRole').value] = $('fcCurator').value;
    }

    function showCurator(role) {
      $('fcCuratorRole').value = role;
      $('fcCurator').value = curatorValue(role);
    }

    showCurator(
      BEASTS.has($('role').value) ? $('role').value : 'animal'
    );

    // Сохраняем исходную сборку имени и звёздочки.
    window.buildFaces = function () {
      originalBuildFaces();
      const color = $('fcHairColor').value.trim();
      if (color) {
        $('facesOut').textContent +=
          ` (натуральный цвет волос: ${color})`;
      }
    };

    let previousId = $('pid').value.trim();
    let automaticDiscordId = '';

    function syncDiscordId() {
      const id = $('pid').value.trim();
      if (id !== previousId) {
        $('fcDiscordId').value = '';
        automaticDiscordId = '';
        previousId = id;
      }

      let found = '';
      try {
        const own = group => group &&
          Object.prototype.hasOwnProperty.call(group, id);
        const player = own(cachedDatabase.humans)
          ? cachedDatabase.humans[id]
          : own(cachedDatabase.animals)
            ? cachedDatabase.animals[id]
            : null;
        if (player) found = userId(player.tag);
      } catch {
        // При недоступной базе работает ручной ввод.
      }

      const field = $('fcDiscordId');
      if (!field.value.trim() || field.value === automaticDiscordId) {
        field.value = found;
        automaticDiscordId = found;
      }
    }

    function playerId() {
      const id = $('pid').value.trim();
      if (!/^\d+$/.test(id)) throw new Error('Введи числовой ID игрока.');
      return id;
    }

    function playerMention() {
      const id = userId($('fcDiscordId').value);
      if (!id) throw new Error('Вставь числовой Discord ID или <@ID>.');
      return `<@${id}>`;
    }

    function message(kind) {
      const id = playerId();

      if (kind === 'faces') {
        if (!$('pname').value.trim()) {
          throw new Error('Заполни имя персонажа.');
        }
        window.buildFaces();
        return $('facesOut').textContent.trim();
      }

      if (kind === 'cooldown') return `.cdr ${playerMention()}`;

      if (kind === 'adult') {
        const staff = mentions($('fcStaff').value, true);
        if (!staff) {
          throw new Error('Заполни упоминания Ассистентов и Мл. Ассистентов.');
        }
        return `${playerMention()} — просьба выдать роль 18+. ${staff}`;
      }

      if (kind !== 'log') throw new Error('Неизвестный шаблон.');

      const helpers = mentions($('fcHelpers').value, false);
      let result = `~ выпустил ${id}`;
      if (helpers) result += ` ft ${helpers}`;

      const role = $('role').value;
      if (BEASTS.has(role)) {
        rememberCurator();
        const curator = mentions(curatorValue(role), true);
        if (!curator) {
          throw new Error(`Укажи куратора для ${role} в настройках.`);
        }
        result += ` ${curator}`;
      }
      return result;
    }

    function prepare(kind) {
      $('fcKind').value = kind;
      $('fcApp').href = url(kind);
      $('fcWeb').href = url(kind, true);
      $('fcPreview').value = '';
      syncDiscordId();
      const text = message(kind);
      $('fcPreview').value = text;
      return text;
    }

    function refresh() {
      window.buildFaces();
      try {
        prepare($('fcKind').value);
        notice('');
      } catch (error) {
        notice(error.message, true);
      }
    }

    // Синхронный вариант нужен для обычного перехода по ссылке
    // непосредственно в обработчике клика.
    function copySynchronously(text) {
      const active = document.activeElement;
      const area = document.createElement('textarea');
      area.value = text;
      area.readOnly = true;
      area.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(area);

      let copied = false;
      try {
        area.focus();
        area.select();
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      } finally {
        area.remove();
        try {
          active?.focus({ preventScroll: true });
        } catch {
          // Восстановление фокуса не влияет на копирование.
        }
      }
      return copied;
    }

    async function copyModern(text) {
      if (!navigator.clipboard?.writeText) return false;
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }

    function manualCopyNotice() {
      $('fcPreview').focus();
      $('fcPreview').select();
      notice(
        'Автокопирование недоступно. Нажми Ctrl+C, затем «Открыть Discord».',
        true
      );
    }

    function bindAction(link, kind) {
      link.href = url(kind);
      link.addEventListener('click', async event => {
        let text;
        try {
          text = prepare(kind);
        } catch (error) {
          event.preventDefault();
          notice(error.message, true);
          return;
        }

        if (copySynchronously(text)) {
          notice('Скопировано. В Discord вставь текст и отправь.');
          // Сохраняем обычный переход по href.
          return;
        }

        // После асинхронного копирования браузер может блокировать
        // запуск приложения. Поэтому предлагаем отдельную ссылку.
        event.preventDefault();
        if (await copyModern(text)) {
          notice('Скопировано. Нажми «Открыть Discord», вставь и отправь.');
        } else {
          manualCopyNotice();
        }
      });
    }

    const facesButton = $('dcBtn');
    if (facesButton) {
      facesButton.removeAttribute('onclick');
      bindAction(facesButton, 'faces');
    }

    panel.querySelectorAll('[data-fc-kind]').forEach(link => {
      bindAction(link, link.dataset.fcKind);
    });

    $('fcCopy').addEventListener('click', async () => {
      try {
        const text = prepare($('fcKind').value);
        const copied = copySynchronously(text) || await copyModern(text);
        if (copied) notice('Текст скопирован.');
        else manualCopyNotice();
      } catch (error) {
        notice(error.message, true);
      }
    });

    $('fcCurator').addEventListener('input', rememberCurator);
    $('fcCuratorRole').addEventListener('change', () => {
      $('fcCurator').value = curatorValue($('fcCuratorRole').value);
      refresh();
    });

    $('fcSave').addEventListener('click', () => {
      try {
        rememberCurator();
        settings.staff = $('fcStaff').value.trim();
        mentions(settings.staff, true);
        Object.values(settings.curators).forEach(value => {
          if (typeof value !== 'string') {
            throw new Error('Некорректные настройки кураторов.');
          }
          mentions(value, true);
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        notice('Настройки сохранены в этом браузере.');
      } catch (error) {
        notice(`Не удалось сохранить: ${error.message}`, true);
      }
    });

    [
      'pid', 'pname', 'fcDiscordId', 'fcHairColor',
      'fcHelpers', 'fcStaff', 'fcCurator'
    ].forEach(id => $(id).addEventListener('input', refresh));

    $('role').addEventListener('change', () => {
      rememberCurator();
      if (BEASTS.has($('role').value)) showCurator($('role').value);
      refresh();
    });

    ['age18', 'fcKind'].forEach(id => {
      $(id).addEventListener('change', refresh);
    });

    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();