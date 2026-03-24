const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');

const token = process.env.TOKEN;
const OWNER_NAME = "@DominionGraphic";
const ADMIN_ID = process.env.ADMIN_ID;

const bot = new TelegramBot(token, { polling: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ===== USERS DATABASE =====
const USERS_FILE = "users.json";

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

function getUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

function addUser(id) {
  let users = getUsers();
  if (!users.includes(id)) {
    users.push(id);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users));
  }
}

// ===== FORCE JOIN =====
const REQUIRED_CHANNELS = [
  "@ROBIN_TECH_GROUP",
  "@telex_md",
  "@telex_MDn"
];

async function isUserJoined(userId) {
  try {
    for (let ch of REQUIRED_CHANNELS) {
      let res = await bot.getChatMember(ch, userId);
      if (res.status === "left" || res.status === "kicked") {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// ===== WAITING STATE =====
let waitingForIP = {};

// ===== START =====
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  addUser(userId);

  let joined = await isUserJoined(userId);

  if (!joined) {
    return bot.sendMessage(chatId,
`🚫 You must join all channels to use this bot!`,
{
  reply_markup: {
    inline_keyboard: [
      [{ text: "📢 Channel 1", url: "https://t.me/ROBIN_TECH_GROUP" }],
      [{ text: "👥 Group", url: "https://t.me/telex_md" }],
      [{ text: "📢 Channel 2", url: "https://t.me/telex_MDn" }],
      [{ text: "✅ I Have Joined", callback_data: "check_join" }]
    ]
  }
});
  }

  bot.sendMessage(chatId,
`Welcome to IP Scanning Machine
>> Scan IP addresses 🌐
>> Extract geolocation, ISP & network info 📡`
  );

  bot.sendMessage(chatId, "Choose an option:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🌐 My IP", callback_data: "myip" }],
        [{ text: "👑 Owner", callback_data: "owner" }],
        [{ text: "📡 Scan IP", callback_data: "scan" }]
      ]
    }
  });
});

// ===== BUTTONS =====
bot.on('callback_query', async (q) => {
  const chatId = q.message.chat.id;
  const userId = q.from.id;

  if (q.data === "check_join") {
    let joined = await isUserJoined(userId);

    if (!joined) {
      return bot.answerCallbackQuery(q.id, {
        text: "❌ Join all channels first!",
        show_alert: true
      });
    }

    bot.answerCallbackQuery(q.id, { text: "✅ Access Granted!" });

    return bot.sendMessage(chatId, "Choose an option:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌐 My IP", callback_data: "myip" }],
          [{ text: "👑 Owner", callback_data: "owner" }],
          [{ text: "📡 Scan IP", callback_data: "scan" }]
        ]
      }
    });
  }

  if (q.data === "myip") {
    return bot.sendMessage(chatId,
`⚠️ I cannot detect your IP automatically.

👇 Tap below to get your IP, then send it here:`,
{
  reply_markup: {
    inline_keyboard: [
      [{ text: "🌐 Get My IP", url: "https://api.ipify.org" }]
    ]
  }
});
  }

  if (q.data === "owner") {
    return bot.sendMessage(chatId, `👑 Owner: ${OWNER_NAME}`);
  }

  if (q.data === "scan") {
    waitingForIP[chatId] = true;

    return bot.sendMessage(chatId,
`📡 Ready to scan...

👉 First, get your IP using "My IP"
👉 Then send it here to scan ⚡`);
  }

  bot.answerCallbackQuery(q.id);
});

// ===== ADMIN PANEL =====
bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, "❌ You are not admin");
  }

  bot.sendMessage(msg.chat.id,
`👑 ADMIN PANEL

/broadcast <text>
/users`);
});

// ===== USERS COUNT =====
bot.onText(/\/users/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;

  let users = getUsers();
  bot.sendMessage(msg.chat.id, `👥 Total Users: ${users.length}`);
});

// ===== BROADCAST =====
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, "❌ Admin only");
  }

  const text = match[1];
  const users = getUsers();

  bot.sendMessage(msg.chat.id, `📡 Broadcasting to ${users.length} users...`);

  let success = 0;
  let failed = 0;

  for (let id of users) {
    try {
      await bot.sendMessage(id, `📢 Broadcast:\n\n${text}`);
      success++;
    } catch {
      failed++;
    }
  }

  bot.sendMessage(msg.chat.id,
`✅ Done
✔ Success: ${success}
❌ Failed: ${failed}`);
});

// ===== HANDLE IP =====
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!waitingForIP[chatId] || !text || text.startsWith('/')) return;
  waitingForIP[chatId] = false;

  try {
    let m = await bot.sendMessage(chatId, `> Initializing data extraction...\n[███▒▒▒▒▒▒▒] 30%`);
    await sleep(300);
    await bot.editMessageText(`> Querying global ISP routing databases...\n[██████▒▒▒▒] 60%`, { chat_id: chatId, message_id: m.message_id });
    await sleep(300);
    await bot.editMessageText(`> Cross-referencing geolocation records...\n[████████▒▒] 80%`, { chat_id: chatId, message_id: m.message_id });
    await sleep(300);
    await bot.editMessageText(`> Extracting precise coordinate data...\n[██████████] 100%`, { chat_id: chatId, message_id: m.message_id });

    const res = await axios.get(`http://ip-api.com/json/${text}?fields=66846719`);
    const d = res.data;

    if (d.status === "fail") {
      return bot.sendMessage(chatId, "❌ Invalid IP");
    }

    let vpn = d.proxy || d.hosting ? "Detected (VPN/Proxy)" : "Not Detected";

    const result = `
┈┈┈┈┈┈┈┈┈┈┈┈┈┈
 Data Extracted Successfully
┈┈┈┈┈┈┈┈┈┈┈┈┈┈

[-] 🎯 Target IP: ${d.query}
[-] 🖥️ Hostname: ${d.reverse || "N/A"}
[-] 📡 Network ISP: ${d.isp}
[-] 🏢 Organization: ${d.org}
[-] 🌐 ASN: ${d.as}
[-] 📍 Location: ${d.city}, ${d.country}
[-] 📮 Zip Code: ${d.zip || "N/A"}
[-] ⏳ Timezone: ${d.timezone}
[-] 📶 Connection Type: ${d.mobile ? "Mobile" : "Broadband"}
[-] 📍 Latitude: ${d.lat}
[-] 🕹 Longitude: ${d.lon}
[-] 🗺️ Map: [Open Location](https://www.google.com/maps?q=${d.lat},${d.lon})
[-] 🛡️ Anonymity Layer: ${vpn}

┈┈┈ <  ~/$${OWNER_NAME}  > ┈┈┈
`;

    bot.sendMessage(chatId, result, { parse_mode: "Markdown" });

  } catch {
    bot.sendMessage(chatId, "⚠️ Error during scan");
  }
});
