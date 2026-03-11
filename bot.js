const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const sanitize = require('sanitize-filename');

class RKEBypassBot {
    constructor(token) {
        this.token = token;
        this.bot = new TelegramBot(token, {
            polling: {
                params: {
                    allowed_updates: ['message', 'callback_query', 'inline_query', 'chosen_inline_result', 'channel_post']
                }
            },
            filepath: false
        });
        this.userLanguages = {};
        this.apiKey = '0440e329-12ac-41a1-b382-bb54c28100f5';
        this.apiBase = 'https://api.izen.lol/v1';
        
        // Supported domains list - will be updated from API
        this.supportedDomains = [];
        
        // Advanced Broadcast system
        this.adminIds = ['6357622851', '6768862370'];
        this.usersFile = 'users.json';
        this.broadcastMode = {};
        this.broadcastData = {};
        this.loadUsers();
        
        // Channel check system - ONLY FOR GROUPS
        this.requiredChannels = [
            { id: '@REKblox', url: 'https://t.me/REKblox', name: 'REK Blox' },
            { id: '@REKblox2', url: 'https://t.me/REKblox2', name: 'REK Blox 2' },
            { id: '@RKR_Blox_Group', url: 'https://t.me/RKR_Blox_Group', name: 'RKR Blox Group' },
            { id: '@KoPuddingSupport', url: 'https://t.me/KoPuddingSupport', name: 'Ko Pudding Support' }
        ];
        
        // Store user join status
        this.userJoinStatus = {};
        
        // Channel Post System
        this.postMode = {};
        this.postData = {};
        this.channelId = '';
        
        // Multi-channel support for posting
        this.postChannels = [
            { id: '@REKblox', url: 'https://t.me/REKblox', name: 'REK Blox' },
            { id: '@REKblox2', url: 'https://t.me/REKblox2', name: 'REK Blox 2' },
            { id: '@KoPuddingSupport', url: 'https://t.me/KoPuddingSupport', name: 'Ko Pudding Support' }
        ];
        this.selectedChannelForPost = {};
        
        // Admin State Management
        this.adminState = {};
        this.setChannelMode = {};
        
        // Auto delete for forwarded messages - ONLY IN GROUPS
        this.enableAutoDelete = true;
        this.deleteDelay = 2000;
        this.warningMessages = {};
        
        // Bot start time for uptime calculation
        this.startTime = Date.now();
        
        // Myanmar timezone offset (UTC+6:30)
        this.myanmarTimezoneOffset = 6.5 * 60 * 60 * 1000;
        
        // Deep Link System
        this.deepLinkMode = {};
        this.deepLinkData = {};
        this.deepLinksFile = 'deeplinks.json';
        this.deepLinks = [];
        this.loadDeepLinks();
        
        // ========== PENDING DEEP LINKS (for join enforcement) ==========
        this.pendingDeepLinks = {};
        
        // History System
        this.historyFile = 'history.json';
        this.history = [];
        this.loadHistory();
        
        // ==================== NEW FEATURES ====================
        // Feedback system
        this.feedbackMode = {};
        this.feedbackData = {};
        this.feedbackWaitingForReply = {};
        this.adminFeedbacks = {}; // Store feedbacks for admin replies
        
        // Auto-delete bypass links
        this.enableAutoDeleteBypass = true;
        this.autoDeleteDelay = 15000; // 15 seconds for successful bypass
        this.failedAutoDeleteDelay = 3000; // 3 seconds for failed bypass
        
        // Supporting/Donation system
        this.paymentMode = {};
        this.paymentData = {};
        this.qrImageUrl = "https://ar-hosting.pages.dev/1770356367385.jpg";
        this.paymentNumber = "09788163900";
        
        // User management
        this.userPageCache = {};
        this.bannedUsersFile = 'banned_users.json';
        this.bannedUsers = [];
        this.loadBannedUsers();
        
        // FIX: Bypass API error handling
        this.bypassTimeout = 60000; // 60 seconds timeout for bypass
        
        // FIX: Message type tracking for edit errors
        this.messageTypes = {};
        
        // Special domain handling for ads.luarmor.net
        this.luarmorRequests = {};
        this.joinMsgTimers = {}; // { userId_chatId: timerId } for auto-delete join msgs
        
        // ========== NEW: Emoji list for quick picker ==========
        this.commonEmojis = ['❤️', '👍', '🔥', '🎉', '😊', '😂', '😢', '👀', '⭐', '✅', '❌', '⚠️', '🔔', '📢', '💰', '🔗', '📝', '🖼️', '🎬', '📁'];
        
        // ========== NEW: Group Moderation (Banned Words) ==========
        this.bannedWords = [
            'badword1', 'badword2', 'example',
            'spam', 'scam', 'fuck', 'shit'
        ];
        this.mutedUsers = {}; // { chatId_userId: expiryTimestamp }

        // ========== NEW: Pending Bypass Requests ==========
        this.pendingBypassRequests = {}; // { userId: { chatId, url, originalMessageId, timestamp } }

        // ========== NEW: Button Wizard States ==========
        this.postButtonWizard = {}; // For channel post buttons
        this.broadcastButtonWizard = {}; // For broadcast buttons
        this.deepLinkButtonWizard = {}; // For deep link buttons

        // ========== WARP GEN ==========
        this.warpTotalCount = this.loadWarpCount();
        this.warpCustomIpWaiting = {};
        this.catboxWaiting = {}; // { chatId: true }

        // ========== SCRIPT BYPASS TOGGLE ==========
        this.scriptBypassEnabled = true;
        this.lastBroadcastStats = null;
        this.userSearchMode = {}; // { chatId: true }

        this.setupHandlers();
        console.log('🤖 RKE Key Bypass Bot စတင်ပါပြီ...');
        
        // Load supported domains from API
        this.updateSupportedDomainsFromAPI();
        
        // Auto update supported domains every 1 hour
        setInterval(() => {
            this.updateSupportedDomainsFromAPI();
        }, 60 * 60 * 1000);

        // Clean up old pending bypass requests every 10 minutes
        setInterval(() => {
            const now = Date.now();
            for (const [userId, req] of Object.entries(this.pendingBypassRequests)) {
                if (now - req.timestamp > 10 * 60 * 1000) { // 10 minutes
                    delete this.pendingBypassRequests[userId];
                }
            }
        }, 10 * 60 * 1000);
    }

    // ==================== NEW: Apply Emoji Formatting ====================
    applyEmojiFormatting(text) {
        if (!text) return text;
        // Pattern: emoji:ID | text (capture ID and text)
        // We replace with <tg-emoji emoji-id="ID"></tg-emoji> text
        // Allows multiple occurrences
        return text.replace(/emoji:(\d+)\s*\|\s*(.+?)(?=emoji:\d+\s*\||$)/gs, (match, id, content) => {
            return `<tg-emoji emoji-id="${id}"></tg-emoji> ${content}`;
        });
    }

    // ==================== NEW: Group Moderation Methods ====================
    async checkBannedWords(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text || msg.caption || '';
        const messageId = msg.message_id;

        // Only in groups, ignore private chats and admins
        const chat = await this.bot.getChat(chatId);
        if (chat.type === 'private') return false;
        if (this.isAdmin(userId.toString())) return false;

        // Check if user is already muted? We still delete message but no need to mute again
        const isMuted = this.mutedUsers[`${chatId}_${userId}`] > Date.now();

        // Check if any banned word appears (simple substring match)
        const lowerText = text.toLowerCase();
        for (const word of this.bannedWords) {
            if (lowerText.includes(word.toLowerCase())) {
                // Delete the message
                try {
                    await this.bot.deleteMessage(chatId, messageId);
                } catch (err) {
                    console.error('Failed to delete banned message:', err.message);
                }

                if (!isMuted) {
                    // Mute user for 1 hour
                    const muteUntil = Date.now() + 60 * 60 * 1000; // 1 hour
                    try {
                        await this.bot.restrictChatMember(chatId, userId, {
                            until_date: Math.floor(muteUntil / 1000),
                            permissions: {
                                can_send_messages: false,
                                can_send_media_messages: false,
                                can_send_polls: false,
                                can_send_other_messages: false,
                                can_add_web_page_previews: false,
                                can_change_info: false,
                                can_invite_users: false,
                                can_pin_messages: false
                            }
                        });
                        this.mutedUsers[`${chatId}_${userId}`] = muteUntil;
                    } catch (err) {
                        console.error('Failed to mute user:', err.message);
                    }

                    // Get user info
                    let username = msg.from.username ? '@' + msg.from.username : 'No username';
                    let fullName = msg.from.first_name || '';
                    if (msg.from.last_name) fullName += ' ' + msg.from.last_name;

                    // Send notification with unmute button
                    const notification = `${username} ${fullName} [${userId}] used a banned word.\nAction: Muted 🔇 until 1h`;
                    const buttons = [
                        [
                            { text: "🔓 Unmute", callback_data: `unmute_${chatId}_${userId}` }
                        ]
                    ];
                    await this.bot.sendMessage(chatId, notification, {
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: buttons }
                    });
                }
                return true;
            }
        }
        return false;
    }

    async unmuteUser(chatId, userId, adminId) {
        // Check if admin is actually admin in that group
        if (!await this.isGroupAdmin(chatId, adminId)) {
            await this.bot.answerCallbackQuery(adminId, { text: "Only group admins can unmute.", show_alert: true });
            return false;
        }
        try {
            await this.bot.restrictChatMember(chatId, userId, {
                permissions: {
                    can_send_messages: true,
                    can_send_media_messages: true,
                    can_send_polls: true,
                    can_send_other_messages: true,
                    can_add_web_page_previews: true,
                    can_change_info: true,
                    can_invite_users: true,
                    can_pin_messages: true
                }
            });
            delete this.mutedUsers[`${chatId}_${userId}`];
            await this.bot.sendMessage(chatId, `User ${userId} has been unmuted.`);
            return true;
        } catch (err) {
            console.error('Unmute error:', err);
            return false;
        }
    }

    async isGroupAdmin(chatId, userId) {
        try {
            const member = await this.bot.getChatMember(chatId, userId);
            return ['administrator', 'creator'].includes(member.status);
        } catch {
            return false;
        }
    }

    // ==================== NEW: Parse Advanced Inline Button Format (Bot API 9.4) ====================
    parseAdvancedInlineButton(buttonStr) {
        // Format: Button Text | data | style:primary/success/danger (optional) | emoji:ID (optional)
        // data can be URL, copy:Text, or callback_data
        const parts = buttonStr.split('|').map(p => p.trim());
        if (parts.length < 2) return null;

        const buttonText = parts[0];
        const mainData = parts[1];
        
        // Build base button object
        let button = { text: buttonText };
        
        // Determine button type from main data
        if (mainData.startsWith('http') || mainData.startsWith('tg://')) {
            button.url = mainData;
        } else if (mainData.startsWith('copy:')) {
            button.copy_text = { text: mainData.substring(5) };
        } else {
            button.callback_data = mainData;
        }

        // Parse additional parameters
        for (let i = 2; i < parts.length; i++) {
            const part = parts[i];
            if (part.startsWith('style:')) {
                const style = part.substring(6);
                // Only allow valid styles per Telegram Bot API 9.4
                if (['primary', 'success', 'danger'].includes(style)) {
                    button.style = style;
                }
            } else if (part.startsWith('emoji:')) {
                const emojiId = part.substring(6);
                if (/^\d+$/.test(emojiId)) {
                    button.icon_custom_emoji_id = emojiId;
                }
            }
        }

        return button;
    }

    // ==================== NEW: Parse Advanced Keyboard Button Format (Bot API 9.4) ====================
    parseAdvancedKeyboardButton(buttonStr) {
        // Format: Button Text | data | style:primary/success/danger (optional)
        // For keyboard buttons, 'data' is ignored (only text matters for display)
        // But we still parse style
        const parts = buttonStr.split('|').map(p => p.trim());
        if (parts.length < 1) return null;

        const buttonText = parts[0];
        
        // Build base button object
        let button = { text: buttonText };

        // Parse additional parameters (style only, with allowed values)
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            if (part.startsWith('style:')) {
                const style = part.substring(6);
                if (['primary', 'success', 'danger'].includes(style)) {
                    button.style = style;
                }
            }
        }

        return button;
    }

    // ==================== PERSONALIZATION FOR BROADCAST ====================
    personalizeText(text, userInfo) {
        if (!text) return text;
        const replacements = {
            '{first_name}': userInfo.first_name || 'User',
            '{username}': userInfo.username ? '@' + userInfo.username : 'N/A',
            '{userid}': userInfo.id.toString()
        };
        let personalized = text;
        for (const [placeholder, value] of Object.entries(replacements)) {
            personalized = personalized.split(placeholder).join(value);
        }
        return personalized;
    }

    // ==================== EMOJI PICKER ====================
    async showEmojiPicker(chatId, messageId, target) {
        // target can be 'content' or 'caption'
        const rows = [];
        for (let i = 0; i < this.commonEmojis.length; i += 5) {
            const row = this.commonEmojis.slice(i, i + 5).map(emoji => ({
                text: emoji,
                callback_data: `emoji_${target}_${emoji}`
            }));
            rows.push(row);
        }
        rows.push([{ text: "❌ ပိတ်ရန်", callback_data: "emoji_cancel" }]);

        try {
            await this.bot.editMessageText("😀 ထည့်လိုတဲ့ Emoji ကို ရွေးပါ:", {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: rows }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error showing emoji picker:', error);
        }
    }

    async handleEmojiPick(chatId, messageId, target, emoji, postData) {
        if (target === 'content') {
            if (postData.type === 'text') {
                postData.content += emoji;
            } else {
                // For media types, emoji goes to caption
                postData.caption += emoji;
            }
        } else if (target === 'caption') {
            postData.caption += emoji;
        }

        // Show updated content preview
        let previewText = `✅ Emoji ထည့်ပြီးပါပြီ။ လက်ရှိ ` + 
            (target === 'content' ? 'စာသား' : 'caption') + `:\n\n`;
        if (postData.type === 'text' && target === 'content') {
            previewText += postData.content;
        } else {
            previewText += postData.caption || '(မရှိသေး)';
        }

        const keyboard = [
            [
                { text: "➕ ထပ်ထည့်ရန်", callback_data: `post_emoji_${target}` },
                { text: "📝 ဆက်လုပ်ရန်", callback_data: "post_back_to_edit" }
            ]
        ];

        await this.bot.editMessageText(previewText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
        this.messageTypes[messageId] = 'text';
    }

    // ==================== COPY BUTTON FOR POST ====================
    async initPostCopyButton(chatId, messageId) {
        const data = this.postData[chatId];
        if (!data) return;

        data.waitingFor = 'copy_text';
        await this.bot.editMessageText("📋 ကော်ပီခလုတ်အတွက် စာသားကို ရိုက်ထည့်ပါ:", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "post_cancel" }]
                ]
            }
        });
        this.messageTypes[messageId] = 'text';
    }

    // ==================== HELPER: Convert text to hyperlinks ====================
    convertTextToHyperlinks(text) {
        // Pattern: "text | url" or "text, url" (space after comma/pipe optional)
        // Also supports tg://user?id=... URLs
        const pattern = /(.*?)[,|]\s*(https?:\/\/[^\s]+|tg:\/\/[^\s]+)/g;
        return text.replace(pattern, '<a href="$2">$1</a>');
    }

    // Check if user is admin
    isAdmin(userId) {
        return this.adminIds.includes(userId.toString());
    }

    // Check if user is banned
    isBanned(userId) {
        return this.bannedUsers.includes(userId.toString());
    }

    // Load users from file
    loadUsers() {
        try {
            if (fs.existsSync(this.usersFile)) {
                const data = fs.readFileSync(this.usersFile, 'utf8');
                this.users = JSON.parse(data);
                console.log(`✅ Loaded ${this.users.length} users from file`);
            } else {
                this.users = [];
                console.log('📁 Creating new users file');
                this.saveUsers();
            }
        } catch (error) {
            console.error('❌ Error loading users:', error);
            this.users = [];
            this.saveUsers();
        }
    }

    // Save users to file
    saveUsers() {
        try {
            fs.writeFileSync(this.usersFile, JSON.stringify(this.users, null, 2));
        } catch (error) {
            console.error('❌ Error saving users:', error);
        }
    }

    // Add new user
    addUser(userId) {
        // Always store as number for getChat compatibility
        const numId = parseInt(userId, 10);
        if (!this.users.some(u => parseInt(u, 10) === numId)) {
            this.users.push(numId);
            this.saveUsers();
        }
    }

    // Load banned users
    loadBannedUsers() {
        try {
            if (fs.existsSync(this.bannedUsersFile)) {
                const data = fs.readFileSync(this.bannedUsersFile, 'utf8');
                this.bannedUsers = JSON.parse(data);
                console.log(`✅ Loaded ${this.bannedUsers.length} banned users from file`);
            } else {
                this.bannedUsers = [];
                console.log('📁 Creating new banned users file');
                this.saveBannedUsers();
            }
        } catch (error) {
            console.error('❌ Error loading banned users:', error);
            this.bannedUsers = [];
            this.saveBannedUsers();
        }
    }

    // Save banned users
    saveBannedUsers() {
        try {
            fs.writeFileSync(this.bannedUsersFile, JSON.stringify(this.bannedUsers, null, 2));
        } catch (error) {
            console.error('❌ Error saving banned users:', error);
        }
    }

    // Ban user
    banUser(userId) {
        // Prevent admin from banning themselves
        if (this.isAdmin(userId)) {
            return false;
        }
        if (!this.bannedUsers.includes(userId.toString())) {
            this.bannedUsers.push(userId.toString());
            this.saveBannedUsers();
            return true;
        }
        return false;
    }

    // Unban user
    unbanUser(userId) {
        const userIdStr = userId.toString();
        const index = this.bannedUsers.indexOf(userIdStr);
        if (index > -1) {
            this.bannedUsers.splice(index, 1);
            this.saveBannedUsers();
            return true;
        }
        return false;
    }

    // ==================== DEEP LINK SYSTEM ====================

    loadDeepLinks() {
        try {
            if (fs.existsSync(this.deepLinksFile)) {
                const data = fs.readFileSync(this.deepLinksFile, 'utf8');
                this.deepLinks = JSON.parse(data);
                console.log(`✅ Loaded ${this.deepLinks.length} deep links from file`);
            } else {
                this.deepLinks = [];
                console.log('📁 Creating new deep links file');
                this.saveDeepLinks();
            }
        } catch (error) {
            console.error('❌ Error loading deep links:', error);
            this.deepLinks = [];
            this.saveDeepLinks();
        }
    }

    saveDeepLinks() {
        try {
            fs.writeFileSync(this.deepLinksFile, JSON.stringify(this.deepLinks, null, 2));
        } catch (error) {
            console.error('❌ Error saving deep links:', error);
        }
    }

    // Get Myanmar Standard Time
    getMyanmarTime() {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const myanmarTime = new Date(utc + this.myanmarTimezoneOffset);
        return myanmarTime;
    }
    
    // Format Myanmar time to readable string
    formatMyanmarTime(date) {
        const myanmarDate = date ? new Date(new Date(date).getTime() + this.myanmarTimezoneOffset) : this.getMyanmarTime();
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        return myanmarDate.toLocaleString('en-US', options);
    }

    generateDeepLinkId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 10; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // ==================== HISTORY SYSTEM ====================

    loadHistory() {
        try {
            if (fs.existsSync(this.historyFile)) {
                const data = fs.readFileSync(this.historyFile, 'utf8');
                this.history = JSON.parse(data);
                console.log(`✅ Loaded ${this.history.length} history entries from file`);
            } else {
                this.history = [];
                console.log('📁 Creating new history file');
                this.saveHistory();
            }
        } catch (error) {
            console.error('❌ Error loading history:', error);
            this.history = [];
            this.saveHistory();
        }
    }

    saveHistory() {
        try {
            fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2));
        } catch (error) {
            console.error('❌ Error saving history:', error);
        }
    }

    addHistoryEntry(type, data) {
        const entry = {
            id: this.generateDeepLinkId(),
            type: type,
            data: data,
            timestamp: new Date().toISOString(),
            usageCount: 0,
            lastUsed: null
        };
        
        this.history.push(entry);
        if (this.history.length > 200) { // Keep only last 200 entries
            this.history = this.history.slice(-200);
        }
        this.saveHistory();
        
        return entry;
    }

    updateHistoryUsage(deepLinkId) {
        const entry = this.history.find(item => item.id === deepLinkId);
        if (entry) {
            entry.usageCount = (entry.usageCount || 0) + 1;
            entry.lastUsed = new Date().toISOString();
            this.saveHistory();
        }
    }

    // Check if domain is supported
    isDomainSupported(url) {
        try {
            const urlObj = new URL(url);
            let hostname = urlObj.hostname.toLowerCase().replace('www.', '');
            
            // Always supported (special handling)
            if (hostname === 'ads.luarmor.net') return true;
            if (hostname === 'loot-link.com' || hostname.endsWith('.loot-link.com')) return true;
            
            // Check if hostname is in supported list
            for (const domain of this.supportedDomains) {
                if (hostname === domain || hostname.endsWith('.' + domain)) {
                    return true;
                }
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    setupHandlers() {
        // ============ /start COMMAND HANDLER WITH DEEP LINK ============
        this.bot.onText(/\/start(?: (.*))?/, async (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const username = msg.from.username || 'N/A';
            const firstName = msg.from.first_name || 'User';
            const deepLinkId = match[1]; // Get deep link parameter
            
            // Check if user is banned
            if (this.isBanned(userId.toString())) {
                await this.bot.sendMessage(chatId, "❌ You have been banned from using this bot.");
                return;
            }
            
            // Add user to database
            this.addUser(userId);
            
            // Handle deep link if provided
            if (deepLinkId) {
                await this.handleDeepLinkStart(chatId, userId, deepLinkId, msg.message_id);
                return;
            }
            
            await this.sendWelcomeMessage(chatId, userId, username, firstName, msg.message_id);
        });

        // ============ /donate COMMAND HANDLER ============
        this.bot.onText(/\/donate/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            
            // Check if user is banned
            if (this.isBanned(userId)) {
                await this.bot.sendMessage(chatId, "❌ You have been banned from using this bot.");
                return;
            }
            
            await this.showSupportingOptions(chatId);
        });

        // ============ /song COMMAND HANDLER (SmartDlBot style) ============
        // /song alone → show music menu
        this.bot.onText(/^\/song$/, async (msg) => {
            await this.showSongMenu(msg.chat.id);
        });

        // /song <query or spotify/youtube link>
        this.bot.onText(/\/song[,\s]+(.+)/, async (msg, match) => {
            const chatId  = msg.chat.id;
            const userId  = msg.from.id;
            const query   = match[1].trim();
            const messageId = msg.message_id;

            if (this.isBanned(userId.toString())) {
                await this.bot.sendMessage(chatId, '❌ You have been banned.', { reply_to_message_id: messageId });
                return;
            }

            const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';

            const statusMsg = await this.bot.sendMessage(chatId,
                `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> ` +
                (isEn ? `Searching <b>"${query}"</b>...` : `<b>"${query}"</b> ကို ရှာဖွေနေပါတယ်...`),
                { reply_to_message_id: messageId, parse_mode: 'HTML' }
            );

            try {
                // Detect if it's a Spotify or YouTube link
                const isSpotify = query.includes('spotify.com/track');
                const isYtMusic = query.includes('music.youtube.com') || query.includes('youtu.be') || query.includes('youtube.com/watch');

                let songName = query;
                let extraMeta = null;

                if (isSpotify) {
                    // Extract Spotify track metadata → search JioSaavn
                    extraMeta = await this.resolveSpotifyTrack(query);
                    songName = extraMeta ? `${extraMeta.title} ${extraMeta.artist}` : query;
                    await this.bot.editMessageText(
                        `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> ` +
                        (isEn ? `Found on Spotify: <b>${extraMeta?.title || songName}</b>\nSearching audio...` : `Spotify မှ ရှာနေပါတယ်: <b>${extraMeta?.title || songName}</b>...`),
                        { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML' }
                    ).catch(() => {});
                } else if (isYtMusic) {
                    // YouTube/YTMusic link → use cobalt for audio
                    await this.bot.editMessageText(
                        `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> ` +
                        (isEn ? `Downloading from YouTube Music...` : `YouTube Music မှ ဒေါင်းလုဒ်လုပ်နေပါတယ်...`),
                        { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML' }
                    ).catch(() => {});
                    const ytResult = await this.fetchYtAudio(query);
                    if (ytResult) {
                        await this.sendMusicFile(chatId, messageId, statusMsg.message_id, ytResult, isEn);
                        return;
                    }
                    throw new Error('not_found');
                }

                // Search JioSaavn
                await this.bot.editMessageText(
                    `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> ` +
                    (isEn ? `Downloading <b>"${extraMeta?.title || songName}"</b>...` : `<b>"${extraMeta?.title || songName}"</b> ဒေါင်းလုဒ်လုပ်နေပါတယ်...`),
                    { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML' }
                ).catch(() => {});

                const result = await this.fetchSong(songName);
                if (!result) throw new Error('not_found');

                // Merge Spotify metadata if available (better cover art etc)
                if (extraMeta) {
                    result.imageUrl = extraMeta.imageUrl || result.imageUrl;
                }

                await this.sendMusicFile(chatId, messageId, statusMsg.message_id, result, isEn);

            } catch (err) {
                console.error('Song error:', err.message);
                const isEn2 = (this.userLanguages?.[chatId] || 'en') === 'en';
                const errText = err.message === 'not_found'
                    ? (isEn2
                        ? `<tg-emoji emoji-id="5258084656674250503">❌</tg-emoji> <b>"${query}"</b> not found.\n\nTry with English name or artist name.`
                        : `<tg-emoji emoji-id="5258084656674250503">❌</tg-emoji> <b>"${query}"</b> ကို ရှာမတွေ့ပါ။\n\nEnglish နာမည် သို့မဟုတ် artist နာမည်နဲ့ ထပ်ကြိုးစားကြည့်ပါ။`)
                    : (isEn2
                        ? `<tg-emoji emoji-id="5258084656674250503">❌</tg-emoji> Download failed. Try again later.`
                        : `<tg-emoji emoji-id="5258084656674250503">❌</tg-emoji> ဒေါင်းလုဒ် မအောင်မြင်ပါ။ နောက်မှ ထပ်ကြိုးစားကြည့်ပါ။`);
                await this.bot.editMessageText(errText, {
                    chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML'
                }).catch(() => {});
            }
        });

        // ============ /dl COMMAND HANDLER (SmartDlBot) ============
        // /dl alone → show menu
        this.bot.onText(/^\/dl$/, async (msg) => {
            await this.showSmartDlMenu(msg.chat.id);
        });

        // /dl <url> → download
        this.bot.onText(/\/dl[,\s]+(.+)/i, async (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const messageId = msg.message_id;
            const url = match[1].trim();

            if (this.isBanned(userId.toString())) return;

            const platform = this.detectPlatform(url);
            if (!platform) {
                await this.bot.sendMessage(chatId,
                    `<tg-emoji emoji-id="5258084656674250503">❌</tg-emoji> <b>Unsupported URL</b>\n\n` +
                    `Supported platforms:\n` +
                    `• <b>TikTok</b> — tiktok.com\n` +
                    `• <b>Instagram</b> — instagram.com (Reels/Posts)\n` +
                    `• <b>Twitter/X</b> — twitter.com / x.com\n` +
                    `• <b>Facebook</b> — facebook.com / fb.watch\n` +
                    `• <b>YouTube</b> — youtube.com / youtu.be\n\n` +
                    `<i>Usage: /dl &lt;link&gt;</i>`,
                    { parse_mode: 'HTML', reply_to_message_id: messageId }
                );
                return;
            }

            const statusMsg = await this.bot.sendMessage(chatId,
                `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> <b>${platform.name}</b> မှ ဒေါင်းလုဒ်လုပ်နေပါတယ်...`,
                { parse_mode: 'HTML', reply_to_message_id: messageId }
            );

            try {
                const result = await this.downloadMedia(url, platform.type);
                if (!result) throw new Error('download_failed');

                await this.bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
                await this.sendDownloadResult(chatId, messageId, result, platform);
                // Auto-delete only the /dl command message
                setTimeout(() => this.bot.deleteMessage(chatId, messageId).catch(() => {}), 3000);

            } catch (err) {
                console.error(`DL error [${platform.type}]:`, err.message);
                await this.bot.editMessageText(
                    `<tg-emoji emoji-id="5258084656674250503">❌</tg-emoji> <b>Download မအောင်မြင်ပါ</b>\n\n` +
                    `<code>${err.message === 'download_failed' ? 'Media ရှာမတွေ့ပါ သို့မဟုတ် Private content ဖြစ်နေသည်' : err.message}</code>\n\n` +
                    `<i>Public content သာ download လုပ်နိုင်သည်</i>`,
                    { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML' }
                ).catch(() => {});
            }
        });

        // Also handle plain links for auto-detect
        // (handled inside message handler)

        // ============ /status COMMAND ============
        this.bot.onText(/^\/status$/, async (msg) => {
            const chatId = msg.chat.id;
            const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
            const stats = await this.getAdminStats();
            const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
            const d = Math.floor(uptimeSec / 86400);
            const h = Math.floor((uptimeSec % 86400) / 3600);
            const m = Math.floor((uptimeSec % 3600) / 60);
            const s = uptimeSec % 60;
            const uptimeStr = `${d}d ${h}h ${m}m ${s}s`;
            const mem = process.memoryUsage();
            const memMB = (mem.rss / 1024 / 1024).toFixed(1);
            const text =
                `<tg-emoji emoji-id="5350618807943576963">⚡</tg-emoji> <b>RKE Bypass Bot — Status</b>\n\n` +
                `<tg-emoji emoji-id="6269163801178804220">🟢</tg-emoji> <b>Status:</b> Online\n` +
                `<tg-emoji emoji-id="6053323501073341449">⏱</tg-emoji> <b>Uptime:</b> <code>${uptimeStr}</code>\n` +
                `<tg-emoji emoji-id="5339141594471742013">💾</tg-emoji> <b>Memory:</b> <code>${memMB} MB</code>\n\n` +
                `<tg-emoji emoji-id="5368324170671202286">👥</tg-emoji> <b>Total Users:</b> <code>${stats.totalUsers}</code>\n` +
                `<tg-emoji emoji-id="5368324170671202286">📊</tg-emoji> <b>Active Today:</b> <code>${stats.activeToday}</code>\n` +
                `<tg-emoji emoji-id="5258084656674250503">🚫</tg-emoji> <b>Banned Users:</b> <code>${this.bannedUsers.length}</code>\n\n` +
                `<tg-emoji emoji-id="5350618807943576963">⚡</tg-emoji> <b>WarpGen Count:</b> <code>${(this.warpTotalCount || 0).toLocaleString()}</code>\n` +
                `<tg-emoji emoji-id="5339141594471742013">🔗</tg-emoji> <b>Deep Links:</b> <code>${this.deepLinks.length}</code>\n` +
                `<tg-emoji emoji-id="5433811242135331842">📋</tg-emoji> <b>Supported Domains:</b> <code>${stats.supportedDomains}</code>\n\n` +
                `<i>Node.js v${process.versions.node}</i>`;
            await this.bot.sendMessage(chatId, text, {
                parse_mode: 'HTML',
                reply_to_message_id: msg.message_id,
                reply_markup: { inline_keyboard: [[
                    { text: isEn ? 'Back to Menu' : 'Menu ပြန်', callback_data: 'back_menu', icon_custom_emoji_id: '5258084656674250503', style: 'success' }
                ]]}
            });
        });

        // ============ /qr COMMAND ============
        this.bot.onText(/^\/qr\s+(.+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const text = match[1].trim();
            const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
            const status = await this.bot.sendMessage(chatId,
                `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> ${isEn ? 'Generating QR code...' : 'QR code ထုတ်နေပါတယ်...'}`,
                { parse_mode: 'HTML', reply_to_message_id: msg.message_id }
            );
            try {
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&ecc=M&data=${encodeURIComponent(text)}`;
                const caption =
                    `<tg-emoji emoji-id="5260450573768990626">➡️</tg-emoji> <b>QR Code</b>\n` +
                    `<tg-emoji emoji-id="5339141594471742013">📝</tg-emoji> <code>${text.length > 60 ? text.slice(0,60)+'...' : text}</code>`;
                await this.bot.sendPhoto(chatId, qrUrl, {
                    caption, parse_mode: 'HTML',
                    reply_to_message_id: msg.message_id,
                    reply_markup: { inline_keyboard: [[
                        { copy_text: { text }, text: isEn ? 'Copy Text' : 'Text ကူးပါ' },
                        { text: isEn ? 'Gen Another' : 'ထပ်ထုတ်မည်', callback_data: 'qr_gen_prompt', icon_custom_emoji_id: '5260450573768990626', style: 'success' }
                    ]]}
                });
                await this.bot.deleteMessage(chatId, status.message_id).catch(() => {});
            } catch (e) {
                await this.bot.editMessageText(`❌ QR generation failed.`, { chat_id: chatId, message_id: status.message_id }).catch(() => {});
            }
        });

        // ============ /short COMMAND ============
        this.bot.onText(/^\/short\s+(https?:\/\/\S+)/, async (msg, match) => {
            const chatId = msg.chat.id;
            const url = match[1].trim();
            const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
            const status = await this.bot.sendMessage(chatId,
                `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> ${isEn ? 'Shortening URL...' : 'URL တိုထောင်နေပါတယ်...'}`,
                { parse_mode: 'HTML', reply_to_message_id: msg.message_id }
            );
            try {
                const r = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 10000 });
                const shortUrl = r.data?.trim();
                if (!shortUrl?.startsWith('http')) throw new Error('failed');
                const text2 =
                    `<tg-emoji emoji-id="5368324170671202286">🔗</tg-emoji> <b>${isEn ? 'Short URL' : 'Short Link'}</b>\n\n` +
                    `<b>${isEn ? 'Original:' : 'မူရင်း:'}</b> <code>${url.length > 50 ? url.slice(0,50)+'...' : url}</code>\n` +
                    `<b>${isEn ? 'Short:' : 'တို:'}</b> <code>${shortUrl}</code>`;
                await this.bot.editMessageText(text2, {
                    chat_id: chatId, message_id: status.message_id, parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: [[
                        { copy_text: { text: shortUrl }, text: isEn ? 'Copy Short URL' : 'Copy' },
                        { text: 'Open', url: shortUrl, icon_custom_emoji_id: '5260450573768990626', style: 'primary' }
                    ]]}
                });
            } catch {
                await this.bot.editMessageText(`❌ ${isEn ? 'URL shortening failed.' : 'URL တိုထောင်မရပါ။'}`, { chat_id: chatId, message_id: status.message_id }).catch(() => {});
            }
        });

        // ============ /ip COMMAND ============
        this.bot.onText(/^\/ip(?:\s+(\S+))?/, async (msg, match) => {
            const chatId = msg.chat.id;
            const target = (match[1] || '').trim();
            const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
            const status = await this.bot.sendMessage(chatId,
                `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> ${isEn ? 'Looking up IP...' : 'IP ကြည့်နေပါတယ်...'}`,
                { parse_mode: 'HTML', reply_to_message_id: msg.message_id }
            );
            try {
                const lookup = target || '';
                const r = await axios.get(`https://ipapi.co/${lookup}json/`, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                const d = r.data;
                if (d.error) throw new Error(d.reason || 'lookup failed');
                const txt =
                    `<tg-emoji emoji-id="5350618807943576963">⚡</tg-emoji> <b>IP Lookup</b>\n\n` +
                    `<tg-emoji emoji-id="6339280615459789282">🌐</tg-emoji> <b>IP:</b> <code>${d.ip}</code>\n` +
                    `<tg-emoji emoji-id="5368324170671202286">📍</tg-emoji> <b>Country:</b> ${d.country_name} (${d.country_code})\n` +
                    `<tg-emoji emoji-id="5339141594471742013">🏙</tg-emoji> <b>City:</b> ${d.city || '-'}, ${d.region || '-'}\n` +
                    `<tg-emoji emoji-id="5258084656674250503">🔌</tg-emoji> <b>ISP:</b> ${d.org || '-'}\n` +
                    `<tg-emoji emoji-id="6053323501073341449">🕐</tg-emoji> <b>Timezone:</b> ${d.timezone || '-'}\n` +
                    `<tg-emoji emoji-id="5260450573768990626">📡</tg-emoji> <b>ASN:</b> ${d.asn || '-'}`;
                await this.bot.editMessageText(txt, {
                    chat_id: chatId, message_id: status.message_id, parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: [[
                        { copy_text: { text: d.ip }, text: 'Copy IP' },
                        { text: isEn ? 'My IP' : 'ကျွန်တော့် IP', callback_data: 'lookup_my_ip', icon_custom_emoji_id: '6339280615459789282', style: 'primary' }
                    ]]}
                });
            } catch (e) {
                await this.bot.editMessageText(`❌ ${isEn ? 'IP lookup failed: ' : 'IP ကြည့်မရပါ: '}<code>${e.message}</code>`, { chat_id: chatId, message_id: status.message_id, parse_mode: 'HTML' }).catch(() => {});
            }
        });

        // ============ /id COMMAND ============
        this.bot.onText(/^\/id$/, async (msg) => {
            const chatId = msg.chat.id;
            const u = msg.from;
            const isGroup = msg.chat.type !== 'private';
            const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
            let txt = `<tg-emoji emoji-id="5368324170671202286">👤</tg-emoji> <b>${isEn ? 'Your Info' : 'သင့် Info'}</b>\n\n` +
                `<tg-emoji emoji-id="5339141594471742013">🆔</tg-emoji> <b>ID:</b> <code>${u.id}</code>\n` +
                `<tg-emoji emoji-id="5350618807943576963">📛</tg-emoji> <b>Name:</b> ${u.first_name || ''}${u.last_name ? ' '+u.last_name : ''}\n` +
                (u.username ? `<tg-emoji emoji-id="5260450573768990626">🔗</tg-emoji> <b>Username:</b> @${u.username}\n` : '') +
                `<tg-emoji emoji-id="6339280615459789282">🌐</tg-emoji> <b>Language:</b> ${u.language_code || 'N/A'}\n` +
                `<tg-emoji emoji-id="5258084656674250503">🤖</tg-emoji> <b>Bot:</b> ${u.is_bot ? 'Yes' : 'No'}`;
            if (isGroup) {
                txt += `\n\n<tg-emoji emoji-id="5433811242135331842">💬</tg-emoji> <b>${isEn ? 'Chat Info' : 'Chat Info'}</b>\n` +
                    `<tg-emoji emoji-id="5339141594471742013">🆔</tg-emoji> <b>Chat ID:</b> <code>${chatId}</code>\n` +
                    `<tg-emoji emoji-id="5350618807943576963">📛</tg-emoji> <b>Title:</b> ${msg.chat.title || 'N/A'}\n` +
                    `<tg-emoji emoji-id="5368324170671202286">📂</tg-emoji> <b>Type:</b> ${msg.chat.type}`;
            }
            await this.bot.sendMessage(chatId, txt, {
                parse_mode: 'HTML', reply_to_message_id: msg.message_id,
                reply_markup: { inline_keyboard: [[
                    { text: isEn ? 'My Profile' : 'Profile', url: `tg://user?id=${u.id}`, icon_custom_emoji_id: '5368324170671202286', style: 'primary' },
                    { copy_text: { text: String(u.id) }, text: isEn ? 'Copy ID' : 'ID ကူး' }
                ]]}
            });
        });

        // ============ /info COMMAND (reply to a user or just use own info) ============
        this.bot.onText(/^\/info$/, async (msg) => {
            const chatId = msg.chat.id;
            const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
            let targetUser = msg.from;
            let targetId = msg.from.id;
            // If replying to someone, show their info
            if (msg.reply_to_message?.from) {
                targetUser = msg.reply_to_message.from;
                targetId = targetUser.id;
            }
            let extraInfo = '';
            try {
                const member = await this.bot.getChatMember(chatId, targetId);
                const statusMap = { creator: '👑 Creator', administrator: '⭐ Admin', member: '👤 Member', restricted: '⚠️ Restricted', left: '🚪 Left', kicked: '🚫 Banned' };
                extraInfo = `\n<tg-emoji emoji-id="5339141594471742013">🏷</tg-emoji> <b>Status:</b> ${statusMap[member.status] || member.status}`;
            } catch {}
            const txt =
                `<tg-emoji emoji-id="5368324170671202286">👤</tg-emoji> <b>${isEn ? 'User Info' : 'User Info'}</b>\n\n` +
                `<tg-emoji emoji-id="5339141594471742013">🆔</tg-emoji> <b>ID:</b> <code>${targetId}</code>\n` +
                `<tg-emoji emoji-id="5350618807943576963">📛</tg-emoji> <b>First Name:</b> ${targetUser.first_name || '-'}\n` +
                (targetUser.last_name ? `<tg-emoji emoji-id="5350618807943576963">📛</tg-emoji> <b>Last Name:</b> ${targetUser.last_name}\n` : '') +
                (targetUser.username ? `<tg-emoji emoji-id="5260450573768990626">🔗</tg-emoji> <b>Username:</b> <a href="https://t.me/${targetUser.username}">@${targetUser.username}</a>\n` : '') +
                `<tg-emoji emoji-id="6339280615459789282">🌐</tg-emoji> <b>Language:</b> ${targetUser.language_code || 'N/A'}\n` +
                `<tg-emoji emoji-id="5258084656674250503">🤖</tg-emoji> <b>Bot:</b> ${targetUser.is_bot ? '✅ Yes' : '❌ No'}` +
                extraInfo +
                `\n\n<tg-emoji emoji-id="5433811242135331842">🔗</tg-emoji> <b>Permanent Link:</b> <a href="tg://user?id=${targetId}">Open Profile</a>`;
            await this.bot.sendMessage(chatId, txt, {
                parse_mode: 'HTML', reply_to_message_id: msg.message_id,
                reply_markup: { inline_keyboard: [[
                    { text: isEn ? 'Open Profile' : 'Profile ဖွင့်', url: `tg://user?id=${targetId}`, icon_custom_emoji_id: '5368324170671202286', style: 'primary' },
                    { copy_text: { text: String(targetId) }, text: isEn ? 'Copy ID' : 'ID ကူး' }
                ]]}
            });
        });

        // ============ /dc COMMAND ============
        this.bot.onText(/^\/dc$/, async (msg) => {
            const chatId = msg.chat.id;
            const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
            // DC info for the sender
            const u = msg.from;
            const dcMap = {
                1: 'DC1 — MIA, Miami USA 🇺🇸',
                2: 'DC2 — AMS, Amsterdam Netherlands 🇳🇱',
                3: 'DC3 — MIA, Miami USA 🇺🇸',
                4: 'DC4 — AMS, Amsterdam Netherlands 🇳🇱',
                5: 'DC5 — SIN, Singapore 🇸🇬'
            };
            // Try to estimate DC from user ID
            const dcGuess = ((u.id >> 28) & 7) || 1; 
            const dcInfo = dcMap[dcGuess] || 'DC1 — MIA, Miami USA 🇺🇸';
            const txt =
                `<tg-emoji emoji-id="6339280615459789282">📡</tg-emoji> <b>${isEn ? 'Telegram DC Info' : 'Telegram DC Info'}</b>\n\n` +
                `<tg-emoji emoji-id="5368324170671202286">👤</tg-emoji> <b>User:</b> ${u.first_name}\n` +
                `<tg-emoji emoji-id="5339141594471742013">🆔</tg-emoji> <b>ID:</b> <code>${u.id}</code>\n` +
                `<tg-emoji emoji-id="5350618807943576963">🌐</tg-emoji> <b>DC:</b> ${dcInfo}\n\n` +
                `<i>${isEn ? 'DC is estimated from User ID' : 'DC သည် User ID မှ ခန့်မှန်းသည်'}</i>`;
            await this.bot.sendMessage(chatId, txt, {
                parse_mode: 'HTML', reply_to_message_id: msg.message_id
            });
        });

        // ============ /chatinfo COMMAND ============
        this.bot.onText(/^\/chatinfo$/, async (msg) => {
            const chatId = msg.chat.id;
            const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
            try {
                const chat = await this.bot.getChat(chatId);
                const typeMap = { private: '👤 Private', group: '👥 Group', supergroup: '🏛 Supergroup', channel: '📢 Channel' };
                let txt =
                    `<tg-emoji emoji-id="5433811242135331842">💬</tg-emoji> <b>${isEn ? 'Chat Info' : 'Chat Info'}</b>\n\n` +
                    `<tg-emoji emoji-id="5339141594471742013">🆔</tg-emoji> <b>Chat ID:</b> <code>${chatId}</code>\n` +
                    `<tg-emoji emoji-id="5350618807943576963">📛</tg-emoji> <b>Title:</b> ${chat.title || chat.first_name || 'N/A'}\n` +
                    `<tg-emoji emoji-id="5368324170671202286">📂</tg-emoji> <b>Type:</b> ${typeMap[chat.type] || chat.type}\n` +
                    (chat.username ? `<tg-emoji emoji-id="5260450573768990626">🔗</tg-emoji> <b>Username:</b> @${chat.username}\n` : '') +
                    (chat.description ? `<tg-emoji emoji-id="5433811242135331842">📝</tg-emoji> <b>Description:</b> ${chat.description.slice(0,100)}\n` : '');
                if (chat.type !== 'private') {
                    try {
                        const count = await this.bot.getChatMembersCount(chatId);
                        txt += `<tg-emoji emoji-id="5368324170671202286">👥</tg-emoji> <b>Members:</b> <code>${count.toLocaleString()}</code>\n`;
                    } catch {}
                    txt += (chat.invite_link ? `<tg-emoji emoji-id="5260450573768990626">🔗</tg-emoji> <b>Invite Link:</b> ${chat.invite_link}` : '');
                }
                await this.bot.sendMessage(chatId, txt, {
                    parse_mode: 'HTML', reply_to_message_id: msg.message_id,
                    reply_markup: chat.invite_link ? { inline_keyboard: [[
                        { text: isEn ? 'Invite Link' : 'Link ဖွင့်', url: chat.invite_link, icon_custom_emoji_id: '5260450573768990626', style: 'success' },
                        { copy_text: { text: String(chatId) }, text: 'Copy ID' }
                    ]]} : undefined
                });
            } catch (e) {
                await this.bot.sendMessage(chatId, `❌ Error: ${e.message}`, { reply_to_message_id: msg.message_id });
            }
        });

        // ============ Forward Detection (forward a msg → get user/chat info) ============
        // ============ /warp COMMAND HANDLER (WarpConfGen) ============
        // ============ /bypass {url} COMMAND (group only) ============
        this.bot.onText(/^\/bypass(?:\s+(.+))?$/i, async (msg, match) => {
            const chatId = msg.chat.id;
            const isGroup = msg.chat.type !== 'private';
            if (!isGroup) return; // Group only
            const userId = msg.from.id.toString();
            const keyUrl = match[1] ? match[1].trim() : null;
            // Always show tutorial video as reply
            let videoMsg;
            try {
                videoMsg = await this.bot.sendVideo(chatId,
                    'https://ar-hosting.pages.dev/1772862994848.mp4',
                    {
                        caption: `<tg-emoji emoji-id="5258093637450866522">🤖</tg-emoji> <b>𝖶𝖺𝗍𝖼𝗁 𝖳𝗁𝖾 𝖵𝗂𝖽𝖾𝗈 𝖮𝗇 𝖧𝗈𝗐 𝖳𝗈 𝖴𝗌𝖾 𝖪𝖾𝗒 𝖫𝗂𝗇𝗄 𝖡𝗒𝗉𝖺𝗌𝗌 𝖨𝗇 𝖳𝗁𝖾 𝖦𝗋𝗈𝗎𝗉</b>`,
                        parse_mode: 'HTML',
                        reply_to_message_id: msg.message_id
                    }
                );
            } catch (e) { videoMsg = null; }
            // Auto-delete /bypass msg + video after 60 seconds
            setTimeout(async () => {
                await this.bot.deleteMessage(chatId, msg.message_id).catch(() => {});
                if (videoMsg) await this.bot.deleteMessage(chatId, videoMsg.message_id).catch(() => {});
            }, 60000);
            // URL provided → DON'T run bypass, video is enough (how-to guide only)
        });

        this.bot.onText(/^\/warp(?:\s+(\d+))?/, async (msg, match) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id;
            const messageId = msg.message_id;
            const count = Math.min(parseInt(match[1]) || 1, 5);

            if (this.isBanned(userId.toString())) {
                await this.bot.sendMessage(chatId, "❌ You have been banned.", { reply_to_message_id: messageId });
                return;
            }

            const statusMsg = await this.bot.sendMessage(chatId,
                `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> WARP Config ${count > 1 ? count + ' ခု ' : ''}ထုတ်နေပါတယ်...`,
                { reply_to_message_id: messageId, parse_mode: 'HTML' }
            );

            try {
                for (let i = 0; i < count; i++) {
                    const cfg = await this.generateWarpConfig();
                    const configText = this.buildWarpConfigFile(cfg);
                    const label = count > 1 ? ` #${i+1}` : '';

                    const caption =
                        `<tg-emoji emoji-id="5341715473882955310">⚙️</tg-emoji> <b>WARP Config${label}</b>\n\n` +
                        `🔑 <b>License:</b> <code>${cfg.license}</code>\n` +
                        `📱 <b>Device ID:</b> <code>${cfg.deviceId}</code>\n` +
                        `🌐 <b>IPv4:</b> <code>${cfg.v4}</code>\n` +
                        `🌐 <b>IPv6:</b> <code>${cfg.v6}</code>\n\n` +
                        `📲 QR Code ကို WireGuard App နဲ့ Scan လုပ်ပါ\n` +
                        `<i>Check out "WireGuard" app ↓</i>`;

                    const replyMarkup = {
                        inline_keyboard: [[
                            {
                                text: "WireGuard App",
                                url: "https://play.google.com/store/apps/details?id=com.wireguard.android",
                                icon_custom_emoji_id: "5260450573768990626",
                                style: "danger"
                            }
                        ]]
                    };

                    // Build minimal config for QR (WireGuard mobile format - no PostUp/PostDown)
                    const qrConfig = this.buildWarpQrConfig(cfg);
                    const qrData = encodeURIComponent(qrConfig);
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&ecc=M&data=${qrData}`;

                    // Download QR image to tmp file then send
                    const qrPath = path.join('/tmp', `warp_qr_${Date.now()}_${i}.png`);
                    let qrSent = false;
                    try {
                        const qrRes = await axios.get(qrUrl, {
                            responseType: 'arraybuffer',
                            timeout: 15000,
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        });
                        fs.writeFileSync(qrPath, Buffer.from(qrRes.data));
                        await this.bot.sendPhoto(chatId, fs.createReadStream(qrPath), {
                            caption: caption,
                            parse_mode: 'HTML',
                            reply_to_message_id: messageId,
                            reply_markup: replyMarkup
                        });
                        fs.unlinkSync(qrPath);
                        qrSent = true;
                    } catch (qrErr) {
                        console.error('QR photo error:', qrErr.message);
                        if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);
                    }

                    // Always also send .conf file
                    const tmpConf = path.join('/tmp', `warp_${Date.now()}_${i}.conf`);
                    fs.writeFileSync(tmpConf, Buffer.from(configText, 'utf-8'));
                    await this.bot.sendDocument(chatId, fs.createReadStream(tmpConf), {
                        caption: qrSent ? `📎 <b>WARP Config${label} (.conf file)</b>` : caption,
                        parse_mode: 'HTML',
                        reply_to_message_id: messageId,
                        reply_markup: qrSent ? undefined : replyMarkup
                    }, { filename: `warp${label.trim() ? label.trim().replace('#','') : ''}.conf` });
                    fs.unlinkSync(tmpConf);
                }

                await this.bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

            } catch (err) {
                console.error('WARP error:', err.message);
                await this.bot.editMessageText(
                    `❌ WARP config ထုတ်ရာမှာ အဆင်မပြေပါ။\n<code>${err.message}</code>`,
                    { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML' }
                ).catch(() => {});
            }
        });

        // ============ ADMIN SECRET COMMAND HANDLER ============
        this.bot.onText(/\/admin/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            
            if (this.isAdmin(userId)) {
                await this.showAdminPanel(chatId, userId);
            } else {
                await this.bot.sendMessage(chatId, "❌ ခွင့်ပြုချက်မရှိပါ!");
            }
        });

        // Handle all messages
        this.bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;
            const userId = msg.from.id.toString();
            const messageId = msg.message_id;
            
            // Check if user is banned
            if (this.isBanned(userId) && !this.isAdmin(userId)) {
                try {
                    await this.bot.deleteMessage(chatId, messageId);
                    await this.bot.sendMessage(chatId, "❌ You have been banned from using this bot.");
                } catch (error) {
                    // Ignore delete errors
                }
                return;
            }
            
            // ============ AUTO DELETE FORWARDED MESSAGES ============
            // FIX: Only in groups, not in private chats
            if (this.enableAutoDelete && msg.chat.type !== 'private' && 
                (msg.forward_from_chat || msg.forward_from || msg.forward_sender_name)) {
                if (!this.isAdmin(userId)) {
                    try {
                        await this.bot.deleteMessage(chatId, messageId);
                        
                        const warningMsg = await this.bot.sendMessage(chatId, 
                            `⚠️ <b>Forwarded messages are not allowed!</b>\n\n` +
                            `Forwarding from channels, groups, or private chats is prohibited in this group.\n` +
                            `Your message has been deleted.`,
                            {
                                parse_mode: 'HTML'
                            }
                        );
                        
                        setTimeout(async () => {
                            try {
                                await this.bot.deleteMessage(chatId, warningMsg.message_id);
                            } catch (e) {
                                if (!e.message.includes('message to delete not found')) {
                                    console.error('Error deleting warning message:', e.message);
                                }
                            }
                        }, 5000);
                        
                        return;
                    } catch (deleteError) {
                        if (!deleteError.message.includes('message to delete not found')) {
                            console.error('Error deleting forwarded message:', deleteError.message);
                        }
                    }
                }
            }

            // ============ NEW: Banned Word Check (Group Moderation) ============
            if (msg.chat.type !== 'private' && !this.isAdmin(userId)) {
                const banned = await this.checkBannedWords(msg);
                if (banned) return; // Message already handled (deleted)
            }
            
            // ============ HANDLE PAYMENT SCREENSHOT ============
            if (this.paymentMode[chatId]) {
                if (msg.photo) {
                    const photoId = msg.photo[msg.photo.length - 1].file_id;
                    const username = msg.from.username || 'N/A';
                    const firstName = msg.from.first_name || 'User';
                    
                    await this.processPaymentScreenshot(chatId, userId, photoId, username, firstName);
                    
                    // Delete user's screenshot message
                    try {
                        await this.bot.deleteMessage(chatId, messageId);
                    } catch (error) {
                        console.error('Error deleting screenshot:', error);
                    }
                    
                    // FIX: Clean up payment mode without using getChatHistory
                    this.cleanupPaymentMode(chatId);
                    
                    return;
                }
            }
            
            // ============ HANDLE FEEDBACK MODE ============
            if (this.feedbackMode[chatId] && this.feedbackData[chatId]) {
                const data = this.feedbackData[chatId];
                
                if (data.waitingFor === 'content') {
                    if (text) {
                        data.content = text;
                        data.type = 'text';
                        await this.sendFeedbackToAdmins(chatId, data);
                    } else if (msg.photo) {
                        data.media = msg.photo[msg.photo.length - 1].file_id;
                        data.type = 'photo';
                        data.caption = msg.caption || '';
                        await this.sendFeedbackToAdmins(chatId, data);
                    } else if (msg.video) {
                        data.media = msg.video.file_id;
                        data.type = 'video';
                        data.caption = msg.caption || '';
                        await this.sendFeedbackToAdmins(chatId, data);
                    } else if (msg.document) {
                        data.media = msg.document.file_id;
                        data.type = 'document';
                        data.caption = msg.caption || '';
                        await this.sendFeedbackToAdmins(chatId, data);
                    } else if (msg.animation) {
                        data.media = msg.animation.file_id;
                        data.type = 'gif';
                        data.caption = msg.caption || '';
                        await this.sendFeedbackToAdmins(chatId, data);
                    } else {
                        await this.bot.sendMessage(chatId, "❌ မလိုက်နာနိုင်သော message အမျိုးအစား။ ကျေးဇူးပြု၍ text, photo, video, သို့မဟုတ် document ကိုသာ ပို့ပါ။");
                        return;
                    }
                }
                return;
            }
            
            // ============ HANDLE ADMIN FEEDBACK REPLY ============
            if (this.isAdmin(userId) && this.feedbackWaitingForReply[chatId] && this.feedbackWaitingForReply[chatId].type === 'feedback_reply') {
                const feedbackId = this.feedbackWaitingForReply[chatId].feedbackId;
                const feedback = this.adminFeedbacks[feedbackId];
                
                if (feedback) {
                    try {
                        // Send reply to user
                        const userChatId = feedback.userId;
                        let replySent = false;
                        
                        if (text) {
                            // Text reply
                            let replyMessage = `📨 <b>Admin မှပြန်ကြားချက်</b>\n\n`;
                            replyMessage += `${text}\n\n`;
                            replyMessage += `<i>သင့်အကြံပြုချက်အတွက် ကျေးဇူးတင်ပါတယ်!</i>`;
                            
                            await this.bot.sendMessage(userChatId, replyMessage, {
                                parse_mode: 'HTML'
                            });
                            replySent = true;
                        } else if (msg.photo) {
                            // Photo reply
                            const photoId = msg.photo[msg.photo.length - 1].file_id;
                            const caption = msg.caption ? 
                                `📨 <b>Admin မှပြန်ကြားချက်</b>\n\n${msg.caption}\n\n<i>သင့်အကြံပြုချက်အတွက် ကျေးဇူးတင်ပါတယ်!</i>` : 
                                `📨 <b>Admin မှပြန်ကြားချက်</b>\n\n<i>သင့်အကြံပြုချက်အတွက် ကျေးဇူးတင်ပါတယ်!</i>`;
                            
                            await this.bot.sendPhoto(userChatId, photoId, {
                                caption: caption,
                                parse_mode: 'HTML'
                            });
                            replySent = true;
                        } else if (msg.video) {
                            // Video reply
                            const videoId = msg.video.file_id;
                            const caption = msg.caption ? 
                                `📨 <b>Admin မှပြန်ကြားချက်</b>\n\n${msg.caption}\n\n<i>သင့်အကြံပြုချက်အတွက် ကျေးဇူးတင်ပါတယ်!</i>` : 
                                `📨 <b>Admin မှပြန်ကြားချက်</b>\n\n<i>သင့်အကြံပြုချက်အတွက် ကျေးဇူးတင်ပါတယ်!</i>`;
                            
                            await this.bot.sendVideo(userChatId, videoId, {
                                caption: caption,
                                parse_mode: 'HTML'
                            });
                            replySent = true;
                        } else if (msg.document) {
                            // Document reply
                            const docId = msg.document.file_id;
                            const caption = msg.caption ? 
                                `📨 <b>Admin မှပြန်ကြားချက်</b>\n\n${msg.caption}\n\n<i>သင့်အကြံပြုချက်အတွက် ကျေးဇူးတင်ပါတယ်!</i>` : 
                                `📨 <b>Admin မှပြန်ကြားချက်</b>\n\n<i>သင့်အကြံပြုချက်အတွက် ကျေးဇူးတင်ပါတယ်!</i>`;
                            
                            await this.bot.sendDocument(userChatId, docId, {
                                caption: caption,
                                parse_mode: 'HTML'
                            });
                            replySent = true;
                        } else if (msg.animation) {
                            // GIF reply
                            const gifId = msg.animation.file_id;
                            const caption = msg.caption ? 
                                `📨 <b>Admin မှပြန်ကြားချက်</b>\n\n${msg.caption}\n\n<i>သင့်အကြံပြုချက်အတွက် ကျေးဇူးတင်ပါတယ်!</i>` : 
                                `📨 <b>Admin မှပြန်ကြားချက်</b>\n\n<i>သင့်အကြံပြုချက်အတွက် ကျေးဇူးတင်ပါတယ်!</i>`;
                            
                            await this.bot.sendAnimation(userChatId, gifId, {
                                caption: caption,
                                parse_mode: 'HTML'
                            });
                            replySent = true;
                        }
                        
                        if (replySent) {
                            // Notify admin
                            const notifyMsg = await this.bot.sendMessage(chatId, "✅ User ထံသို့ ပြန်ကြားချက် ပို့ပြီးပါပြီ!", {
                                parse_mode: 'HTML'
                            });
                            
                            // Auto delete notification after 3 seconds
                            setTimeout(async () => {
                                try {
                                    await this.bot.deleteMessage(chatId, notifyMsg.message_id);
                                } catch (e) {
                                    console.error('Error deleting notification:', e.message);
                                }
                            }, 3000);
                            
                            // Clean up
                            delete this.feedbackWaitingForReply[chatId];
                        } else {
                            await this.bot.sendMessage(chatId, "❌ မလိုက်နာနိုင်သော message အမျိုးအစား။ ကျေးဇူးပြု၍ text, photo, video, သို့မဟုတ် document ကိုသာ ပို့ပါ။");
                        }
                        
                    } catch (error) {
                        console.error('Error sending feedback reply:', error);
                        await this.bot.sendMessage(chatId, "❌ ပြန်ကြားချက် ပို့ရန် မအောင်မြင်ပါ။ User က bot ကို block ထားနိုင်သည်။");
                    }
                }
                return;
            }
            
            // ============ HANDLE ADMIN PAYMENT REPLY ============
            if (this.isAdmin(userId) && this.feedbackWaitingForReply[chatId] && this.feedbackWaitingForReply[chatId].type === 'payment_reply') {
                const targetUserId = this.feedbackWaitingForReply[chatId].userId;
                
                try {
                    if (text) {
                        await this.bot.sendMessage(targetUserId, `💰 <b>Payment Confirmation</b>\n\n${text}\n\n<i>ကျေးဇူးတင်ပါတယ်!</i>`, {
                            parse_mode: 'HTML'
                        });
                        
                        // Notify admin
                        await this.bot.sendMessage(chatId, "✅ Payment confirmation sent to user!", {
                            parse_mode: 'HTML'
                        });
                    } else if (msg.photo) {
                        const photoId = msg.photo[msg.photo.length - 1].file_id;
                        const caption = msg.caption ? 
                            `💰 <b>Payment Confirmation</b>\n\n${msg.caption}\n\n<i>ကျေးဇူးတင်ပါတယ်!</i>` : 
                            `💰 <b>Payment Confirmation</b>\n\n<i>ကျေးဇူးတင်ပါတယ်!</i>`;
                        
                        await this.bot.sendPhoto(targetUserId, photoId, {
                            caption: caption,
                            parse_mode: 'HTML'
                        });
                        
                        // Notify admin
                        await this.bot.sendMessage(chatId, "✅ Payment confirmation sent to user!", {
                            parse_mode: 'HTML'
                        });
                    }
                    
                    // Clean up
                    delete this.feedbackWaitingForReply[chatId];
                } catch (error) {
                    console.error('Error sending payment reply:', error);
                    await this.bot.sendMessage(chatId, "❌ Failed to send confirmation. User may have blocked the bot.");
                }
                return;
            }
            
            // ============ HANDLE ADMIN LUARMOR REPLY ============
            if (this.isAdmin(userId) && this.feedbackWaitingForReply[chatId] && this.feedbackWaitingForReply[chatId].type === 'luarmor_reply') {
                const requestId = this.feedbackWaitingForReply[chatId].requestId;
                const request = this.luarmorRequests[requestId];
                
                if (!request) {
                    await this.bot.sendMessage(chatId, "❌ Request not found or expired.");
                    delete this.feedbackWaitingForReply[chatId];
                    return;
                }
                
                const targetChatId = request.chatId;   // group or private
                const targetUserId = request.userId;
                const replyToMsgId = request.originalUserMsgId; // user's original link msg
                const isGroupRequest = targetChatId !== targetUserId;

                // Determine message type and content
                let resultText = '';
                let mediaType = null;
                let mediaId = null;

                if (text) {
                    resultText = text; mediaType = 'text';
                } else if (msg.photo) {
                    mediaId = msg.photo[msg.photo.length - 1].file_id;
                    mediaType = 'photo'; resultText = msg.caption || '';
                } else if (msg.video) {
                    mediaId = msg.video.file_id;
                    mediaType = 'video'; resultText = msg.caption || '';
                } else if (msg.document) {
                    mediaId = msg.document.file_id;
                    mediaType = 'document'; resultText = msg.caption || '';
                } else if (msg.animation) {
                    mediaId = msg.animation.file_id;
                    mediaType = 'animation'; resultText = msg.caption || '';
                } else {
                    await this.bot.sendMessage(chatId, "❌ မလိုက်နာနိုင်သော message အမျိုးအစား");
                    return;
                }

                // Sanitize result text
                const cleanResult = resultText.replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim();
                const userMessageText = `<tg-emoji emoji-id="6269163801178804220">✅</tg-emoji> 𝖲𝖼𝗋𝗂𝗉𝗍 𝖡𝗒𝗉𝖺𝗌𝗌 𝖲𝗎𝖼𝖼𝖾𝗌𝗌 [𝖠𝖽𝗌 𝗅𝗎𝖺𝗋𝗆𝗈𝗋]\n\nResult: ${cleanResult}`;
                let replyMarkup;
                try {
                    replyMarkup = { inline_keyboard: [[
                        { text: "𝖲𝖼𝗋𝗂𝗉𝗍 𝖪𝖾𝗒 𝖢𝗈𝗉𝗒", copy_text: { text: cleanResult }, style: 'success' }
                    ]] };
                } catch { replyMarkup = undefined; }
                const resultText2 = cleanResult; // alias for sendOptions below

                const sendOptions = {
                    parse_mode: 'HTML',
                    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
                    reply_to_message_id: replyToMsgId || null
                };

                try {
                    let sentMsg;
                    if (mediaType === 'text') {
                        sentMsg = await this.bot.sendMessage(targetChatId, userMessageText, sendOptions);
                    } else if (mediaType === 'photo') {
                        sentMsg = await this.bot.sendPhoto(targetChatId, mediaId, { ...sendOptions, caption: userMessageText });
                    } else if (mediaType === 'video') {
                        sentMsg = await this.bot.sendVideo(targetChatId, mediaId, { ...sendOptions, caption: userMessageText });
                    } else if (mediaType === 'document') {
                        sentMsg = await this.bot.sendDocument(targetChatId, mediaId, { ...sendOptions, caption: userMessageText });
                    } else if (mediaType === 'animation') {
                        sentMsg = await this.bot.sendAnimation(targetChatId, mediaId, { ...sendOptions, caption: userMessageText });
                    }

                    // Notify admin
                    const notifyMsg = await this.bot.sendMessage(chatId, "✅ Result sent to user!");
                    setTimeout(() => this.bot.deleteMessage(chatId, notifyMsg.message_id).catch(() => {}), 3000);

                    // Delete ⌛ Processing message immediately (both group & private)
                    const procMsgId = request.messageId; // ⌛ processing msg id
                    if (procMsgId) {
                        await this.bot.deleteMessage(targetChatId, procMsgId).catch(() => {});
                    }

                    // Clean up
                    delete this.feedbackWaitingForReply[chatId];
                    delete this.luarmorRequests[requestId];

                    // Group: auto-delete user link msg + result msg after 15s simultaneously
                    if (isGroupRequest && sentMsg) {
                        setTimeout(async () => {
                            await Promise.all([
                                replyToMsgId ? this.bot.deleteMessage(targetChatId, replyToMsgId).catch(() => {}) : Promise.resolve(),
                                this.bot.deleteMessage(targetChatId, sentMsg.message_id).catch(() => {})
                            ]);
                        }, 15000);
                    }
                } catch (error) {
                    console.error('Error sending luarmor reply to user:', error);
                    await this.bot.sendMessage(chatId, "❌ Failed to send result to user.");
                }
                return;
            }
            
            // ============ HANDLE ADMIN STATE (BAN/UNBAN) ============
            if (this.isAdmin(userId) && this.adminState[chatId]) {
                await this.handleAdminState(chatId, userId, text, msg);
                return;
            }
            
            // ============ HANDLE DEEP LINK MODE ============
            if (this.isAdmin(userId) && this.deepLinkMode[chatId] && this.deepLinkData[chatId]) {
                const data = this.deepLinkData[chatId];

                // ── Deep Link Button Wizard text/data/emoji steps ──
                if (this.deepLinkButtonWizard[chatId]) {
                    const wizard = this.deepLinkButtonWizard[chatId];
                    if (wizard.step === 'text' && text) {
                        await this.handleDeepLinkButtonText(chatId, text);
                        return;
                    } else if (wizard.step === 'data' && text) {
                        await this.handleDeepLinkButtonData(chatId, text);
                        return;
                    } else if (wizard.step === 'emoji' && text) {
                        await this.handleDeepLinkButtonEmoji(chatId, text);
                        return;
                    }
                    return;
                }
                
                if (data.waitingFor === 'content') {
                    // Convert text to hyperlinks if type is text
                    if (data.type === 'text' && text) {
                        // Apply emoji formatting first, then hyperlinks
                        let formatted = this.applyEmojiFormatting(text);
                        formatted = this.convertTextToHyperlinks(formatted);
                        data.content = formatted;
                    } else {
                        data.content = text;
                    }
                    data.waitingFor = null;
                    await this.bot.sendMessage(chatId, "✅ Content သိမ်းဆည်းပြီးပါပြီ! ယခု ခလုတ်များထည့်နိုင်သည် သို့မဟုတ် deep link ကို generate လုပ်နိုင်ပါပြီ။", {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "🔗 ခလုတ်များ ထည့်ရန်", callback_data: "deeplink_buttons" },
                                    { text: "📝 စာသား ပြင်ရန်", callback_data: "deeplink_edit_text" }
                                ],
                                [
                                    { text: "👁️ ကြိုတင်ကြည့်ရန်", callback_data: "deeplink_preview" },
                                    { text: "🚀 Link Generate", callback_data: "deeplink_generate" }
                                ],
                                [
                                    { text: "❌ ပယ်ဖျက်ရန်", callback_data: "deeplink_cancel" }
                                ]
                            ]
                        }
                    });
                }
                else if (data.waitingFor === 'buttons') {
                    await this.processDeepLinkButtonsInput(chatId, text);
                }
                else if (data.waitingFor === 'caption') {
                    if (text === '/skip') {
                        data.caption = '';
                    } else {
                        data.caption = text;
                    }
                    data.waitingFor = null;
                    await this.bot.sendMessage(chatId, "✅ Caption သိမ်းဆည်းပြီးပါပြီ! ယခု ခလုတ်များထည့်နိုင်သည် သို့မဟုတ် deep link ကို generate လုပ်နိုင်ပါပြီ။", {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "🔗 ခလုတ်များ ထည့်ရန်", callback_data: "deeplink_buttons" },
                                    { text: "📝 Caption ပြင်ရန်", callback_data: "deeplink_edit_caption" }
                                ],
                                [
                                    { text: "👁️ ကြိုတင်ကြည့်ရန်", callback_data: "deeplink_preview" },
                                    { text: "🚀 Link Generate", callback_data: "deeplink_generate" }
                                ],
                                [
                                    { text: "❌ ပယ်ဖျက်ရန်", callback_data: "deeplink_cancel" }
                                ]
                            ]
                        }
                    });
                }
                else if (data.waitingFor === 'copy_text') {
                    data.copyText = text;
                    data.showCopyButton = true;
                    data.waitingFor = null;
                    await this.bot.sendMessage(chatId, `✅ Copy text သိမ်းဆည်းပြီးပါပြီ! Users များသည် "Copy Script" ခလုတ်ကို မြင်ရပါမည်။\n\nCopy လုပ်မည့်စာသား: "${text}"`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "👁️ ကြိုတင်ကြည့်ရန်", callback_data: "deeplink_preview" },
                                    { text: "🚀 Link Generate", callback_data: "deeplink_generate" }
                                ],
                                [
                                    { text: "❌ ပယ်ဖျက်ရန်", callback_data: "deeplink_cancel" }
                                ]
                            ]
                        }
                    });
                }
                else if (data.waitingFor === 'poll_options') {
                    const options = text.split('\n').filter(opt => opt.trim());
                    if (options.length < 2) {
                        await this.bot.sendMessage(chatId, "⚠️ Poll တွင် အနည်းဆုံး option ၂ ခု ပါရပါမည်!", {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "deeplink_cancel" }]
                                ]
                            }
                        });
                        return;
                    }
                    if (options.length > 10) {
                        await this.bot.sendMessage(chatId, "⚠️ Poll တွင် အများဆုံး option ၁၀ ခု သာ ပါရပါမည်!", {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "deeplink_cancel" }]
                                ]
                            }
                        });
                        return;
                    }
                    
                    data.pollOptions = options.slice(0, 10);
                    data.waitingFor = null;
                    
                    await this.bot.sendMessage(chatId, `✅ Poll options သိမ်းဆည်းပြီးပါပြီ (${data.pollOptions.length} options)။ ယခု ကြိုတင်ကြည့်နိုင်သည် သို့မဟုတ် link ကို generate လုပ်နိုင်ပါပြီ။`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "👁️ ကြိုတင်ကြည့်ရန်", callback_data: "deeplink_preview" },
                                    { text: "🚀 Link Generate", callback_data: "deeplink_generate" }
                                ],
                                [
                                    { text: "❌ ပယ်ဖျက်ရန်", callback_data: "deeplink_cancel" }
                                ]
                            ]
                        }
                    });
                }
                return;
            }
            
            // ============ HANDLE SET CHANNEL MODE ============
            if (this.isAdmin(userId) && this.setChannelMode[chatId]) {
                const channelId = text.trim();
                
                if (channelId.startsWith('@') || channelId.startsWith('-100')) {
                    this.channelId = channelId;
                    delete this.setChannelMode[chatId];
                    
                    const perms = await this.checkChannelPermissions(this.channelId);
                    
                    if (!perms.exists || !perms.isAdmin || !perms.canPost) {
                        let errorMsg = `❌ Channel set လုပ်ထားသော်လည်း ခွင့်ပြုချက် ပြဿနာရှိနေပါသည်!\n\n`;
                        errorMsg += `<b>Channel:</b> <code>${this.channelId}</code>\n`;
                        
                        if (!perms.exists) {
                            errorMsg += "• Channel မတွေ့ပါ\n";
                        } else {
                            if (!perms.isAdmin) {
                                errorMsg += "• Bot သည် admin မဟုတ်ပါ\n";
                            }
                            if (!perms.canPost) {
                                errorMsg += "• Bot သည် message များ ပို့၍မရပါ\n";
                            }
                        }
                        
                        errorMsg += "\nကျေးဇူးပြု၍ ခွင့်ပြုချက်များ ပြင်ဆင်ပြီး ထပ်ကြိုးစားပါ။";
                        
                        await this.bot.sendMessage(chatId, errorMsg, {
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: "🔧 ခွင့်ပြုချက်များ စစ်ဆေးရန်", callback_data: "admin_channel_info" }],
                                    [{ text: "⬅️ Admin သို့ ပြန်ရန်", callback_data: "admin_back" }]
                                ]
                            }
                        });
                    } else {
                        await this.bot.sendMessage(chatId, `✅ Channel သတ်မှတ်ပြီးပါပြီ!\n\n<code>${this.channelId}</code>\n\n<b>ခေါင်းစဉ်:</b> ${perms.chat.title}\n<b>အမျိုးအစား:</b> ${perms.chat.type}\n\nBot တွင် ပို့စ်တင်ခွင့် အပြည့်အစုံရှိပါသည်။ ✅`, {
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: "📝 ပို့စ်ဖန်တီးရန်", callback_data: "admin_create_post" }],
                                    [{ text: "⬅️ Admin သို့ ပြန်ရန်", callback_data: "admin_back" }]
                                ]
                            }
                        });
                    }
                } else {
                    await this.bot.sendMessage(chatId, "❌ Channel ID format မှားယွင်းနေပါသည်!\n\nသုံးရန်နည်းလမ်း:\n• @channel_username\n• -1001234567890 (Channel ID)\n\nကျေးဇူးပြု၍ ထပ်ကြိုးစားပါ သို့မဟုတ် ပယ်ဖျက်ပါ:", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "admin_cancel" }]
                            ]
                        }
                    });
                }
                return;
            }
            
            // ── Admin User Search ──
            if (this.userSearchMode && this.userSearchMode[chatId]) {
                const q = (msg.text || '').trim();
                if (q && !q.startsWith('/')) {
                    delete this.userSearchMode[chatId];
                    const isEn2 = (this.userLanguages?.[chatId] || 'en') === 'en';
                    const sMsg = await this.bot.sendMessage(chatId,
                        `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> ${isEn2 ? 'Looking up user...' : 'User ရှာနေပါတယ်...'}`,
                        { parse_mode: 'HTML' }
                    );
                    try {
                        const target = q.startsWith('@') ? q : (isNaN(q) ? q : parseInt(q));
                        const info = await this.bot.getChat(target);
                        const isRegistered = this.users.includes(String(info.id)) || this.users.includes(info.id);
                        const isBanned2 = this.isBanned(String(info.id));
                        const txt =
                            `<tg-emoji emoji-id="5368324170671202286">👤</tg-emoji> <b>User Info</b>\n\n` +
                            `<tg-emoji emoji-id="5339141594471742013">🆔</tg-emoji> <b>ID:</b> <code>${info.id}</code>\n` +
                            `<tg-emoji emoji-id="5350618807943576963">📛</tg-emoji> <b>Name:</b> ${info.first_name || ''}${info.last_name ? ' '+info.last_name : ''}\n` +
                            (info.username ? `<tg-emoji emoji-id="5260450573768990626">🔗</tg-emoji> <b>Username:</b> @${info.username}\n` : '') +
                            `<tg-emoji emoji-id="6339280615459789282">📊</tg-emoji> <b>Registered:</b> ${isRegistered ? '✅ Yes' : '❌ No'}\n` +
                            `<tg-emoji emoji-id="5258084656674250503">🚫</tg-emoji> <b>Banned:</b> ${isBanned2 ? '🔴 Yes' : '🟢 No'}`;
                        await this.bot.editMessageText(txt, {
                            chat_id: chatId, message_id: sMsg.message_id, parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: [[
                                { text: 'Profile', url: `tg://user?id=${info.id}`, icon_custom_emoji_id: '5368324170671202286', style: 'primary' },
                                isBanned2
                                    ? { text: 'Unban', callback_data: `unban_user_${info.id}`, icon_custom_emoji_id: '6269163801178804220', style: 'success' }
                                    : { text: 'Ban', callback_data: `ban_user_${info.id}`, icon_custom_emoji_id: '5258084656674250503', style: 'danger' }
                            ], [
                                { text: 'Search Again', callback_data: 'admin_user_search', icon_custom_emoji_id: '5339141594471742013', style: 'success' },
                                { text: 'Admin Panel', callback_data: 'admin_panel', icon_custom_emoji_id: '6280276539430932448', style: 'primary' }
                            ]]}
                        });
                    } catch (e) {
                        await this.bot.editMessageText(
                            `❌ ${isEn2 ? 'User not found: ' : 'User မတွေ့ပါ: '}<code>${q}</code>`,
                            { chat_id: chatId, message_id: sMsg.message_id, parse_mode: 'HTML' }
                        ).catch(() => {});
                    }
                    return;
                }
            }

            // ── Catbox file upload ──
            if (this.catboxWaiting && this.catboxWaiting[chatId]) {
                const hasFile = msg.photo || msg.video || msg.document || msg.audio || msg.voice || msg.video_note;
                if (hasFile) {
                    delete this.catboxWaiting[chatId];
                    const statusMsg = await this.bot.sendMessage(chatId,
                        `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> Catbox ကို upload လုပ်နေပါတယ်...`,
                        { parse_mode: 'HTML', reply_to_message_id: messageId }
                    );
                    try {
                        const fileId = msg.document?.file_id || msg.video?.file_id || msg.photo?.slice(-1)[0]?.file_id || msg.audio?.file_id || msg.voice?.file_id || msg.video_note?.file_id;
                        const fileName = msg.document?.file_name || msg.video?.file_name || msg.audio?.file_name || `file_${Date.now()}`;
                        const result = await this.uploadToCatbox(fileId, fileName, chatId);
                        await this.bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
                        const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
                        await this.bot.sendMessage(chatId,
                            `<tg-emoji emoji-id="5260450573768990626">➡️</tg-emoji> <b>Catbox Upload</b>\n\n` +
                            `📎 <b>${isEn ? 'File' : 'ဖိုင်'}:</b> <code>${result.fileName}</code>\n` +
                            `🔗 <b>URL:</b> <code>${result.url}</code>`,
                            {
                                parse_mode: 'HTML',
                                reply_to_message_id: messageId,
                                reply_markup: { inline_keyboard: [[
                                    { copy_text: { text: result.url }, text: isEn ? 'Copy URL' : 'URL ကူးပါ' },
                                    { text: isEn ? 'Upload More' : 'ထပ်တင်မည်', callback_data: 'catbox_upload_start', icon_custom_emoji_id: '5260450573768990626', style: 'success' }
                                ]] }
                            }
                        );
                    } catch (err) {
                        console.error('Catbox error:', err.message);
                        await this.bot.editMessageText(
                            `<tg-emoji emoji-id="5258084656674250503">❌</tg-emoji> Upload မအောင်မြင်ပါ: <code>${err.message}</code>`,
                            { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML' }
                        ).catch(() => {});
                    }
                    return;
                }
            }

            // ── WARP Custom IP input ──
            if (this.warpCustomIpWaiting && this.warpCustomIpWaiting[chatId] && text && !text.startsWith('/')) {
                delete this.warpCustomIpWaiting[chatId];
                let customIp = null, customPort = null;
                const input = text.trim();
                if (input.includes(':')) {
                    const parts = input.split(':');
                    customIp = parts[0].trim();
                    customPort = parts[1].trim();
                } else {
                    customIp = input;
                    customPort = '2408';
                }
                const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
                const label = `Custom (${customIp}:${customPort})`;
                await this.execWarpGeneration(chatId, customIp, customPort, label, 1);
                return;
            }

            // Check if admin is in broadcast mode and adding content
            if (this.isAdmin(userId) && this.broadcastMode[chatId] && this.broadcastData[chatId]) {
                const data = this.broadcastData[chatId];

                // ── Broadcast Button Wizard text/data/emoji steps ──
                if (this.broadcastButtonWizard[chatId]) {
                    const wizard = this.broadcastButtonWizard[chatId];
                    if (wizard.step === 'text' && text) {
                        await this.handleBroadcastButtonText(chatId, text);
                        return;
                    } else if (wizard.step === 'data' && text) {
                        await this.handleBroadcastButtonData(chatId, text);
                        return;
                    } else if (wizard.step === 'emoji' && text) {
                        await this.handleBroadcastButtonEmoji(chatId, text);
                        return;
                    }
                    return;
                }
                
                if (data.waitingFor === 'content') {
                    // Format text for scripts AND convert to hyperlinks AND apply emoji
                    if (data.type === 'text') {
                        let formatted = this.applyEmojiFormatting(text);
                        formatted = this.convertTextToHyperlinks(formatted);
                        data.content = formatted;
                    } else {
                        data.content = text;
                    }
                    data.waitingFor = null;
                    await this.bot.sendMessage(chatId, "✅ Message content သိမ်းဆည်းပြီးပါပြီ! ယခု ခလုတ်များထည့်နိုင်သည် သို့မဟုတ် broadcast ပို့နိုင်ပါပြီ။", {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "🔗 ခလုတ်များ ထည့်ရန်", callback_data: "broadcast_buttons" },
                                    { text: "📝 စာသား ပြင်ရန်", callback_data: "broadcast_edit_text" }
                                ],
                                [
                                    { text: "👁️ ကြိုတင်ကြည့်ရန်", callback_data: "broadcast_preview" },
                                    { text: "🚀 ယခုပို့ရန်", callback_data: "broadcast_send" }
                                ],
                                [
                                    { text: "❌ ပယ်ဖျက်ရန်", callback_data: "broadcast_cancel" }
                                ]
                            ]
                        }
                    });
                }
                else if (data.waitingFor === 'buttons') {
                    // Instead of parsing text, start the interactive button wizard
                    await this.startBroadcastButtonWizard(chatId, messageId);
                }
                else if (data.waitingFor === 'caption') {
                    // Apply emoji formatting to caption
                    let formatted = this.applyEmojiFormatting(text);
                    data.caption = formatted;
                    data.waitingFor = null;
                    await this.bot.sendMessage(chatId, "✅ Caption သိမ်းဆည်းပြီးပါပြီ! ယခု ခလုတ်များထည့်နိုင်သည် သို့မဟုတ် broadcast ပို့နိုင်ပါပြီ။", {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "🔗 ခလုတ်များ ထည့်ရန်", callback_data: "broadcast_buttons" },
                                    { text: "📝 Caption ပြင်ရန်", callback_data: "broadcast_edit_caption" }
                                ],
                                [
                                    { text: "👁️ ကြိုတင်ကြည့်ရန်", callback_data: "broadcast_preview" },
                                    { text: "🚀 ယခုပို့ရန်", callback_data: "broadcast_send" }
                                ],
                                [
                                    { text: "❌ ပယ်ဖျက်ရန်", callback_data: "broadcast_cancel" }
                                ]
                            ]
                        }
                    });
                }
                return;
            }
            
            // ============ HANDLE POST CREATION MODE ============
            if (this.isAdmin(userId) && this.postMode[chatId] && this.postData[chatId]) {
                const data = this.postData[chatId];

                // ── Post Button Wizard text/data/emoji steps ──
                if (this.postButtonWizard[chatId]) {
                    const wizard = this.postButtonWizard[chatId];
                    if (wizard.step === 'text' && text) {
                        await this.handlePostButtonText(chatId, text);
                        return;
                    } else if (wizard.step === 'data' && text) {
                        await this.handlePostButtonData(chatId, text);
                        return;
                    } else if (wizard.step === 'emoji' && text) {
                        await this.handlePostButtonEmoji(chatId, text);
                        return;
                    }
                    return;
                }
                
                if (data.waitingFor === 'content') {
                    // Format text for scripts AND convert to hyperlinks AND apply emoji
                    if (data.type === 'text') {
                        let formatted = this.applyEmojiFormatting(text);
                        formatted = this.convertTextToHyperlinks(formatted);
                        data.content = formatted;
                    } else {
                        data.content = text;
                    }
                    data.waitingFor = null;
                    await this.bot.sendMessage(chatId, "✅ ပို့စ် content သိမ်းဆည်းပြီးပါပြီ! ယခု ခလုတ်များထည့်နိုင်သည် သို့မဟုတ် ကြိုတင်ကြည့်နိုင်ပါပြီ။", {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "🔗 ခလုတ်များ ထည့်ရန်", callback_data: "post_buttons" },
                                    { text: "📝 စာသား ပြင်ရန်", callback_data: "post_edit_text" }
                                ],
                                [
                                    { text: "😀 Emoji", callback_data: "post_emoji_content" },
                                    { text: "📋 Copy Button", callback_data: "post_add_copy" }
                                ],
                                [
                                    { text: "👁️ ကြိုတင်ကြည့်ရန်", callback_data: "post_preview" },
                                    { text: "🚀 ယခုတင်ရန်", callback_data: "post_publish" }
                                ],
                                [
                                    { text: "❌ ပယ်ဖျက်ရန်", callback_data: "post_cancel" }
                                ]
                            ]
                        }
                    });
                }
                else if (data.waitingFor === 'buttons') {
                    // Start interactive button wizard instead of parsing text
                    await this.startPostButtonWizard(chatId, messageId);
                }
                else if (data.waitingFor === 'caption') {
                    // Apply emoji formatting to caption
                    let formatted = this.applyEmojiFormatting(text);
                    data.caption = formatted;
                    data.waitingFor = null;
                    await this.bot.sendMessage(chatId, "✅ Caption သိမ်းဆည်းပြီးပါပြီ! ယခု ခလုတ်များထည့်နိုင်သည် သို့မဟုတ် တင်နိုင်ပါပြီ။", {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "🔗 ခလုတ်များ ထည့်ရန်", callback_data: "post_buttons" },
                                    { text: "📝 Caption ပြင်ရန်", callback_data: "post_edit_caption" }
                                ],
                                [
                                    { text: "😀 Emoji", callback_data: "post_emoji_caption" },
                                    { text: "📋 Copy Button", callback_data: "post_add_copy" }
                                ],
                                [
                                    { text: "👁️ ကြိုတင်ကြည့်ရန်", callback_data: "post_preview" },
                                    { text: "🚀 ယခုတင်ရန်", callback_data: "post_publish" }
                                ],
                                [
                                    { text: "❌ ပယ်ဖျက်ရန်", callback_data: "post_cancel" }
                                ]
                            ]
                        }
                    });
                }
                else if (data.waitingFor === 'copy_text') {
                    data.copyText = text;
                    data.showCopyButton = true;
                    data.waitingFor = null;
                    await this.bot.sendMessage(chatId, `✅ Copy text သိမ်းဆည်းပြီးပါပြီ! ယခု ကြိုတင်ကြည့်နိုင်သည် သို့မဟုတ် တင်နိုင်ပါပြီ။\n\nCopy လုပ်မည့်စာသား: "${text}"`, {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    { text: "👁️ Preview", callback_data: "post_preview" },
                                    { text: "🚀 Publish", callback_data: "post_publish" }
                                ],
                                [
                                    { text: "❌ Cancel", callback_data: "post_cancel" }
                                ]
                            ]
                        }
                    });
                }
                else if (data.waitingFor === 'poll_options') {
                    await this.processPollOptions(chatId, text);
                }
                return;
            }
            
            // Check forwarded messages - show origin info
            if (msg.forward_origin || msg.forward_from || msg.forward_from_chat || msg.forward_sender_name) {
                const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
                let fwdTxt = `<tg-emoji emoji-id="5260450573768990626">➡️</tg-emoji> <b>${isEn ? 'Forwarded From' : 'Forwarded From'}</b>\n\n`;
                const fwdUser = msg.forward_from;
                const fwdChat = msg.forward_from_chat;
                const fwdOrigin = msg.forward_origin;
                if (fwdUser) {
                    fwdTxt +=
                        `<tg-emoji emoji-id="5339141594471742013">🆔</tg-emoji> <b>ID:</b> <code>${fwdUser.id}</code>\n` +
                        `<tg-emoji emoji-id="5350618807943576963">📛</tg-emoji> <b>Name:</b> ${fwdUser.first_name || ''}${fwdUser.last_name ? ' '+fwdUser.last_name : ''}\n` +
                        (fwdUser.username ? `<tg-emoji emoji-id="5260450573768990626">🔗</tg-emoji> <b>Username:</b> @${fwdUser.username}\n` : '') +
                        `<tg-emoji emoji-id="6339280615459789282">🌐</tg-emoji> <b>Lang:</b> ${fwdUser.language_code || 'N/A'}\n` +
                        `<tg-emoji emoji-id="5258084656674250503">🤖</tg-emoji> <b>Bot:</b> ${fwdUser.is_bot ? 'Yes' : 'No'}`;
                    await this.bot.sendMessage(chatId, fwdTxt, {
                        parse_mode: 'HTML', reply_to_message_id: messageId,
                        reply_markup: { inline_keyboard: [[
                            { text: isEn ? 'Open Profile' : 'Profile', url: `tg://user?id=${fwdUser.id}`, icon_custom_emoji_id: '5368324170671202286', style: 'primary' },
                            { copy_text: { text: String(fwdUser.id) }, text: 'Copy ID' }
                        ]]}
                    });
                } else if (fwdChat) {
                    fwdTxt +=
                        `<tg-emoji emoji-id="5339141594471742013">🆔</tg-emoji> <b>Chat ID:</b> <code>${fwdChat.id}</code>\n` +
                        `<tg-emoji emoji-id="5350618807943576963">📛</tg-emoji> <b>Title:</b> ${fwdChat.title || 'N/A'}\n` +
                        (fwdChat.username ? `<tg-emoji emoji-id="5260450573768990626">🔗</tg-emoji> <b>Username:</b> @${fwdChat.username}\n` : '') +
                        `<tg-emoji emoji-id="5368324170671202286">📂</tg-emoji> <b>Type:</b> ${fwdChat.type}`;
                    await this.bot.sendMessage(chatId, fwdTxt, {
                        parse_mode: 'HTML', reply_to_message_id: messageId,
                        reply_markup: fwdChat.username ? { inline_keyboard: [[
                            { text: 'Open Chat', url: `https://t.me/${fwdChat.username}`, icon_custom_emoji_id: '5260450573768990626', style: 'success' },
                            { copy_text: { text: String(fwdChat.id) }, text: 'Copy ID' }
                        ]]} : undefined
                    });
                } else if (msg.forward_sender_name) {
                    fwdTxt += `<tg-emoji emoji-id="5368324170671202286">👤</tg-emoji> <b>Name:</b> ${msg.forward_sender_name}\n<i>(Hidden account — privacy enabled)</i>`;
                    await this.bot.sendMessage(chatId, fwdTxt, { parse_mode: 'HTML', reply_to_message_id: messageId });
                }
                return;
            }

            // Check if it's a URL (not a command)
            if (text && !text.startsWith('/')) {
                // Try to extract URL from entities if text itself isn't a URL
                let urlToProcess = this.isValidUrl(text) ? text : null;
                if (!urlToProcess && msg.entities) {
                    for (const entity of msg.entities) {
                        if ((entity.type === 'url' || entity.type === 'text_link') && entity.url) {
                            urlToProcess = entity.url;
                            break;
                        }
                    }
                }
                if (urlToProcess) {
                    await this.processBypassRequest(chatId, urlToProcess, messageId, userId);
                }
            }
        });

        // ============ MEDIA HANDLERS FOR DEEP LINK ============
        this.bot.on('photo', async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            
            // Check if user is banned
            if (this.isBanned(userId) && !this.isAdmin(userId)) {
                try {
                    await this.bot.deleteMessage(chatId, msg.message_id);
                    await this.bot.sendMessage(chatId, "❌ You have been banned from using this bot.");
                } catch (error) {
                    // Ignore delete errors
                }
                return;
            }
            
            // Handle forwarded photos for auto delete - ONLY IN GROUPS
            if (this.enableAutoDelete && msg.chat.type !== 'private' && 
                (msg.forward_from_chat || msg.forward_from || msg.forward_sender_name)) {
                if (!this.isAdmin(userId)) {
                    try {
                        await this.bot.deleteMessage(chatId, msg.message_id);
                        
                        const warningMsg = await this.bot.sendMessage(chatId, 
                            `⚠️ <b>Forwarded photos are not allowed!</b>\n\n` +
                            `Forwarding from channels, groups, or private chats is prohibited in this group.\n` +
                            `Your photo has been deleted.`,
                            {
                                parse_mode: 'HTML'
                            }
                        );
                        
                        setTimeout(async () => {
                            try {
                                await this.bot.deleteMessage(chatId, warningMsg.message_id);
                            } catch (e) {
                                if (!e.message.includes('message to delete not found')) {
                                    console.error('Error deleting warning message:', e.message);
                                }
                            }
                        }, 5000);
                        
                        return;
                    } catch (deleteError) {
                        if (!deleteError.message.includes('message to delete not found')) {
                            console.error('Error deleting forwarded photo:', deleteError.message);
                        }
                    }
                }
            }
            
            // Deep link photo handling
            if (this.isAdmin(userId) && this.deepLinkMode[chatId] && this.deepLinkData[chatId]) {
                const data = this.deepLinkData[chatId];
                if (data.type === 'photo' && !data.media) {
                    data.media = msg.photo[msg.photo.length - 1].file_id;
                    data.waitingFor = 'caption';
                    await this.bot.sendMessage(chatId, "✅ ဓာတ်ပုံရရှိပါပြီ! ယခု caption ပို့ပါ (သို့မဟုတ် ကျော်ရန် /skip ပို့ပါ):", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "deeplink_cancel" }]
                            ]
                        }
                    });
                }
            }
            
            // Existing photo handling for broadcast and post
            if (this.isAdmin(userId) && this.broadcastMode[chatId] && this.broadcastData[chatId]) {
                const data = this.broadcastData[chatId];
                if (data.type === 'photo' && !data.media) {
                    data.media = msg.photo[msg.photo.length - 1].file_id;
                    data.waitingFor = 'caption';
                    await this.bot.sendMessage(chatId, "✅ ဓာတ်ပုံရရှိပါပြီ! ယခု ဤဓာတ်ပုံအတွက် caption ပို့ပါ (သို့မဟုတ် caption ကျော်ရန် /skip ပို့ပါ):", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "broadcast_cancel" }]
                            ]
                        }
                    });
                }
            }
            
            if (this.isAdmin(userId) && this.postMode[chatId] && this.postData[chatId]) {
                const data = this.postData[chatId];
                if (data.type === 'photo' && !data.media) {
                    data.media = msg.photo[msg.photo.length - 1].file_id;
                    data.waitingFor = 'caption';
                    await this.bot.sendMessage(chatId, "✅ ဓာတ်ပုံရရှိပါပြီ! ယခု caption ပို့ပါ (သို့မဟုတ် ကျော်ရန် /skip ပို့ပါ):", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "post_cancel" }]
                            ]
                        }
                    });
                }
            }
        });

        this.bot.on('video', async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            
            // Check if user is banned
            if (this.isBanned(userId) && !this.isAdmin(userId)) {
                try {
                    await this.bot.deleteMessage(chatId, msg.message_id);
                    await this.bot.sendMessage(chatId, "❌ You have been banned from using this bot.");
                } catch (error) {
                    // Ignore delete errors
                }
                return;
            }
            
            // Handle forwarded videos - ONLY IN GROUPS
            if (this.enableAutoDelete && msg.chat.type !== 'private' && 
                (msg.forward_from_chat || msg.forward_from || msg.forward_sender_name)) {
                if (!this.isAdmin(userId)) {
                    try {
                        await this.bot.deleteMessage(chatId, msg.message_id);
                        
                        const warningMsg = await this.bot.sendMessage(chatId, 
                            `⚠️ <b>Forwarded videos are not allowed!</b>\n\n` +
                            `Forwarding from channels, groups, or private chats is prohibited in this group.\n` +
                            `Your video has been deleted.`,
                            {
                                parse_mode: 'HTML'
                            }
                        );
                        
                        setTimeout(async () => {
                            try {
                                await this.bot.deleteMessage(chatId, warningMsg.message_id);
                            } catch (e) {
                                if (!e.message.includes('message to delete not found')) {
                                    console.error('Error deleting warning message:', e.message);
                                }
                            }
                        }, 5000);
                        
                        return;
                    } catch (deleteError) {
                        if (!deleteError.message.includes('message to delete not found')) {
                            console.error('Error deleting forwarded video:', deleteError.message);
                        }
                    }
                }
            }
            
            // Deep link video handling
            if (this.isAdmin(userId) && this.deepLinkMode[chatId] && this.deepLinkData[chatId]) {
                const data = this.deepLinkData[chatId];
                if (data.type === 'video' && !data.media) {
                    data.media = msg.video.file_id;
                    data.waitingFor = 'caption';
                    await this.bot.sendMessage(chatId, "✅ ဗီဒီယိုရရှိပါပြီ! ယခု caption ပို့ပါ (သို့မဟုတ် ကျော်ရန် /skip ပို့ပါ):", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "deeplink_cancel" }]
                            ]
                        }
                    });
                }
            }
            
            // Existing video handling
            if (this.isAdmin(userId) && this.broadcastMode[chatId] && this.broadcastData[chatId]) {
                const data = this.broadcastData[chatId];
                if (data.type === 'video' && !data.media) {
                    data.media = msg.video.file_id;
                    data.waitingFor = 'caption';
                    await this.bot.sendMessage(chatId, "✅ ဗီဒီယိုရရှိပါပြီ! ယခု ဤဗီဒီယိုအတွက် caption ပို့ပါ (သို့မဟုတ် caption ကျော်ရန် /skip ပို့ပါ):", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "broadcast_cancel" }]
                            ]
                        }
                    });
                }
            }
            
            if (this.isAdmin(userId) && this.postMode[chatId] && this.postData[chatId]) {
                const data = this.postData[chatId];
                if (data.type === 'video' && !data.media) {
                    data.media = msg.video.file_id;
                    data.waitingFor = 'caption';
                    await this.bot.sendMessage(chatId, "✅ ဗီဒီယိုရရှိပါပြီ! ယခု caption ပို့ပါ (သို့မဟုတ် ကျော်ရန် /skip ပို့ပါ):", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "post_cancel" }]
                            ]
                        }
                    });
                }
            }
        });

        this.bot.on('document', async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            
            // Check if user is banned
            if (this.isBanned(userId) && !this.isAdmin(userId)) {
                try {
                    await this.bot.deleteMessage(chatId, msg.message_id);
                    await this.bot.sendMessage(chatId, "❌ You have been banned from using this bot.");
                } catch (error) {
                    // Ignore delete errors
                }
                return;
            }
            
            // Handle forwarded documents - ONLY IN GROUPS
            if (this.enableAutoDelete && msg.chat.type !== 'private' && 
                (msg.forward_from_chat || msg.forward_from || msg.forward_sender_name)) {
                if (!this.isAdmin(userId)) {
                    try {
                        await this.bot.deleteMessage(chatId, msg.message_id);
                        
                        const warningMsg = await this.bot.sendMessage(chatId, 
                            `⚠️ <b>Forwarded documents are not allowed!</b>\n\n` +
                            `Forwarding from channels, groups, or private chats is prohibited in this group.\n` +
                            `Your document has been deleted.`,
                            {
                                parse_mode: 'HTML'
                            }
                        );
                        
                        setTimeout(async () => {
                            try {
                                await this.bot.deleteMessage(chatId, warningMsg.message_id);
                            } catch (e) {
                                if (!e.message.includes('message to delete not found')) {
                                    console.error('Error deleting warning message:', e.message);
                                }
                            }
                        }, 5000);
                        
                        return;
                    } catch (deleteError) {
                        if (!deleteError.message.includes('message to delete not found')) {
                            console.error('Error deleting forwarded document:', deleteError.message);
                        }
                    }
                }
            }
            
            // Deep link document handling
            if (this.isAdmin(userId) && this.deepLinkMode[chatId] && this.deepLinkData[chatId]) {
                const data = this.deepLinkData[chatId];
                if (data.type === 'document' && !data.media) {
                    data.media = msg.document.file_id;
                    data.waitingFor = 'caption';
                    await this.bot.sendMessage(chatId, "✅ ဖိုင်ရရှိပါပြီ! ယခု caption ပို့ပါ (သို့မဟုတ် ကျော်ရန် /skip ပို့ပါ):", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "deeplink_cancel" }]
                            ]
                        }
                    });
                }
            }
            
            // Existing document handling
            if (this.isAdmin(userId) && this.broadcastMode[chatId] && this.broadcastData[chatId]) {
                const data = this.broadcastData[chatId];
                if (data.type === 'document' && !data.media) {
                    data.media = msg.document.file_id;
                    data.waitingFor = 'caption';
                    await this.bot.sendMessage(chatId, "✅ ဖိုင်ရရှိပါပြီ! ယခု ဤဖိုင်အတွက် caption ပို့ပါ (သို့မဟုတ် caption ကျော်ရန် /skip ပို့ပါ):", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "broadcast_cancel" }]
                            ]
                        }
                    });
                }
            }
            
            if (this.isAdmin(userId) && this.postMode[chatId] && this.postData[chatId]) {
                const data = this.postData[chatId];
                if (data.type === 'document' && !data.media) {
                    data.media = msg.document.file_id;
                    data.waitingFor = 'caption';
                    await this.bot.sendMessage(chatId, "✅ ဖိုင်ရရှိပါပြီ! ယခု caption ပို့ပါ (သို့မဟုတ် ကျော်ရန် /skip ပို့ပါ):", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "post_cancel" }]
                            ]
                        }
                    });
                }
            }
        });

        this.bot.on('animation', async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            
            // Check if user is banned
            if (this.isBanned(userId) && !this.isAdmin(userId)) {
                try {
                    await this.bot.deleteMessage(chatId, msg.message_id);
                    await this.bot.sendMessage(chatId, "❌ You have been banned from using this bot.");
                } catch (error) {
                    // Ignore delete errors
                }
                return;
            }
            
            // Handle forwarded GIFs - ONLY IN GROUPS
            if (this.enableAutoDelete && msg.chat.type !== 'private' && 
                (msg.forward_from_chat || msg.forward_from || msg.forward_sender_name)) {
                if (!this.isAdmin(userId)) {
                    try {
                        await this.bot.deleteMessage(chatId, msg.message_id);
                        
                        const warningMsg = await this.bot.sendMessage(chatId, 
                            `⚠️ <b>Forwarded GIFs are not allowed!</b>\n\n` +
                            `Forwarding from channels, groups, or private chats is prohibited in this group.\n` +
                            `Your GIF has been deleted.`,
                            {
                                parse_mode: 'HTML'
                            }
                        );
                        
                        setTimeout(async () => {
                            try {
                                await this.bot.deleteMessage(chatId, warningMsg.message_id);
                            } catch (e) {
                                if (!e.message.includes('message to delete not found')) {
                                    console.error('Error deleting warning message:', e.message);
                                }
                            }
                        }, 5000);
                        
                        return;
                    } catch (deleteError) {
                        if (!deleteError.message.includes('message to delete not found')) {
                            console.error('Error deleting forwarded GIF:', deleteError.message);
                        }
                    }
                }
            }
            
            // Deep link GIF handling
            if (this.isAdmin(userId) && this.deepLinkMode[chatId] && this.deepLinkData[chatId]) {
                const data = this.deepLinkData[chatId];
                if (data.type === 'gif' && !data.media) {
                    data.media = msg.animation.file_id;
                    data.waitingFor = 'caption';
                    await this.bot.sendMessage(chatId, "✅ GIF ရရှိပါပြီ! ယခု caption ပို့ပါ (သို့မဟုတ် ကျော်ရန် /skip ပို့ပါ):", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "deeplink_cancel" }]
                            ]
                        }
                    });
                }
            }
            
            // Existing GIF handling
            if (this.isAdmin(userId) && this.broadcastMode[chatId] && this.broadcastData[chatId]) {
                const data = this.broadcastData[chatId];
                if (data.type === 'gif' && !data.media) {
                    data.media = msg.animation.file_id;
                    data.waitingFor = 'caption';
                    await this.bot.sendMessage(chatId, "✅ GIF ရရှိပါပြီ! ယခု ဤ GIF အတွက် caption ပို့ပါ (သို့မဟုတ် caption ကျော်ရန် /skip ပို့ပါ):", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "broadcast_cancel" }]
                            ]
                        }
                    });
                }
            }
            
            if (this.isAdmin(userId) && this.postMode[chatId] && this.postData[chatId]) {
                const data = this.postData[chatId];
                if (data.type === 'gif' && !data.media) {
                    data.media = msg.animation.file_id;
                    data.waitingFor = 'caption';
                    await this.bot.sendMessage(chatId, "✅ GIF ရရှိပါပြီ! ယခု caption ပို့ပါ (သို့မဟုတ် ကျော်ရန် /skip ပို့ပါ):", {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "❌ ပယ်ဖျက်ရန်", callback_data: "post_cancel" }]
                            ]
                        }
                    });
                }
            }
        });

        // Handle other media types (stickers, audio, voice) for auto delete only
        this.bot.on('sticker', async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            
            // Check if user is banned
            if (this.isBanned(userId) && !this.isAdmin(userId)) {
                try {
                    await this.bot.deleteMessage(chatId, msg.message_id);
                    await this.bot.sendMessage(chatId, "❌ You have been banned from using this bot.");
                } catch (error) {
                    // Ignore delete errors
                }
                return;
            }
            
            if (this.enableAutoDelete && msg.chat.type !== 'private' && 
                (msg.forward_from_chat || msg.forward_from || msg.forward_sender_name)) {
                if (!this.isAdmin(userId)) {
                    try {
                        await this.bot.deleteMessage(chatId, msg.message_id);
                        
                        const warningMsg = await this.bot.sendMessage(chatId, 
                            `⚠️ <b>Forwarded stickers are not allowed!</b>\n\n` +
                            `Forwarding from channels, groups, or private chats is prohibited in this group.\n` +
                            `Your sticker has been deleted.`,
                            {
                                parse_mode: 'HTML'
                            }
                        );
                        
                        setTimeout(async () => {
                            try {
                                await this.bot.deleteMessage(chatId, warningMsg.message_id);
                            } catch (e) {
                                if (!e.message.includes('message to delete not found')) {
                                    console.error('Error deleting warning message:', e.message);
                                }
                            }
                        }, 5000);
                    } catch (deleteError) {
                        if (!deleteError.message.includes('message to delete not found')) {
                            console.error('Error deleting forwarded sticker:', deleteError.message);
                        }
                    }
                }
            }
        });

        this.bot.on('audio', async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            
            // Check if user is banned
            if (this.isBanned(userId) && !this.isAdmin(userId)) {
                try {
                    await this.bot.deleteMessage(chatId, msg.message_id);
                    await this.bot.sendMessage(chatId, "❌ You have been banned from using this bot.");
                } catch (error) {
                    // Ignore delete errors
                }
                return;
            }
            
            if (this.enableAutoDelete && msg.chat.type !== 'private' && 
                (msg.forward_from_chat || msg.forward_from || msg.forward_sender_name)) {
                if (!this.isAdmin(userId)) {
                    try {
                        await this.bot.deleteMessage(chatId, msg.message_id);
                        
                        const warningMsg = await this.bot.sendMessage(chatId, 
                            `⚠️ <b>Forwarded audio is not allowed!</b>\n\n` +
                            `Forwarding from channels, groups, or private chats is prohibited in this group.\n` +
                            `Your audio has been deleted.`,
                            {
                                parse_mode: 'HTML'
                            }
                        );
                        
                        setTimeout(async () => {
                            try {
                                await this.bot.deleteMessage(chatId, warningMsg.message_id);
                            } catch (e) {
                                if (!e.message.includes('message to delete not found')) {
                                    console.error('Error deleting warning message:', e.message);
                                }
                            }
                        }, 5000);
                    } catch (deleteError) {
                        if (!deleteError.message.includes('message to delete not found')) {
                            console.error('Error deleting forwarded audio:', deleteError.message);
                        }
                    }
                }
            }
        });

        this.bot.on('voice', async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from.id.toString();
            
            // Check if user is banned
            if (this.isBanned(userId) && !this.isAdmin(userId)) {
                try {
                    await this.bot.deleteMessage(chatId, msg.message_id);
                    await this.bot.sendMessage(chatId, "❌ You have been banned from using this bot.");
                } catch (error) {
                    // Ignore delete errors
                }
                return;
            }
            
            if (this.enableAutoDelete && msg.chat.type !== 'private' && 
                (msg.forward_from_chat || msg.forward_from || msg.forward_sender_name)) {
                if (!this.isAdmin(userId)) {
                    try {
                        await this.bot.deleteMessage(chatId, msg.message_id);
                        
                        const warningMsg = await this.bot.sendMessage(chatId, 
                            `⚠️ <b>Forwarded voice messages are not allowed!</b>\n\n` +
                            `Forwarding from channels, groups, or private chats is prohibited in this group.\n` +
                            `Your voice message has been deleted.`,
                            {
                                parse_mode: 'HTML'
                            }
                        );
                        
                        setTimeout(async () => {
                            try {
                                await this.bot.deleteMessage(chatId, warningMsg.message_id);
                            } catch (e) {
                                if (!e.message.includes('message to delete not found')) {
                                    console.error('Error deleting warning message:', e.message);
                                }
                            }
                        }, 5000);
                    } catch (deleteError) {
                        if (!deleteError.message.includes('message to delete not found')) {
                            console.error('Error deleting forwarded voice message:', deleteError.message);
                        }
                    }
                }
            }
        });

        // ============ CALLBACK QUERY HANDLER ============
        this.bot.on('callback_query', async (callbackQuery) => {
            const chatId = callbackQuery.message.chat.id;
            const data = callbackQuery.data;
            const messageId = callbackQuery.message.message_id;
            const user = callbackQuery.from;
            const userId = user.id.toString();

            // Check if user is banned
            if (this.isBanned(userId) && !this.isAdmin(userId)) {
                try {
                    await this.bot.deleteMessage(chatId, messageId);
                    await this.bot.answerCallbackQuery(callbackQuery.id, {
                        text: "❌ You have been banned from using this bot.",
                        show_alert: true
                    });
                } catch (error) {
                    // Ignore delete errors
                }
                return;
            }

            try {
                // FIX: Track message type for safe editing
                if (!this.messageTypes[messageId]) {
                    this.messageTypes[messageId] = 'text';
                }
                
                // Answer all callback queries first
                await this.bot.answerCallbackQuery(callbackQuery.id);
                
                // ============ SUPPORTING/DONATION CALLBACKS ============
                if (data === 'user_supporting') {
                    // Delete current message and show new one
                    try {
                        await this.bot.deleteMessage(chatId, messageId);
                    } catch (error) {
                        console.error('Error deleting message:', error);
                    }
                    await this.showSupportingOptions(chatId);
                }
                else if (data === 'supporting_payment') {
                    // Delete current message and show new one
                    try {
                        await this.bot.deleteMessage(chatId, messageId);
                    } catch (error) {
                        console.error('Error deleting message:', error);
                    }
                    await this.showPaymentMethods(chatId);
                }
                else if (data === 'supporting_qr') {
                    // Delete current message and show new one
                    try {
                        await this.bot.deleteMessage(chatId, messageId);
                    } catch (error) {
                        console.error('Error deleting message:', error);
                    }
                    await this.showQRPayment(chatId);
                }
                else if (data === 'supporting_send_screenshot') {
                    await this.initScreenshotUpload(chatId, messageId);
                }
                else if (data === 'supporting_cancel') {
                    // Delete current message and show new one
                    try {
                        await this.bot.deleteMessage(chatId, messageId);
                    } catch (error) {
                        console.error('Error deleting message:', error);
                    }
                    await this.showSupportingOptions(chatId);
                }
                else if (data.startsWith('admin_payment_reply_')) {
                    const targetUserId = data.replace('admin_payment_reply_', '');
                    await this.initPaymentReply(chatId, messageId, targetUserId);
                }
                
                // ============ FEEDBACK CALLBACKS ============
                else if (data === 'user_feedback') {
                    await this._deleteMsg(chatId, messageId);
                    await this.initFeedback(chatId, null, user);
                }
                else if (data === 'feedback_cancel') {
                    // Delete current message and show new one
                    try {
                        await this.bot.deleteMessage(chatId, messageId);
                    } catch (error) {
                        console.error('Error deleting feedback menu:', error);
                    }
                    await this.goBackToMenu(chatId, messageId, user);
                }
                else if (data.startsWith('feedback_reply_')) {
                    const feedbackId = data.replace('feedback_reply_', '');
                    await this.initFeedbackReply(chatId, messageId, feedbackId);
                }
                else if (data.startsWith('feedback_view_')) {
                    const feedbackId = data.replace('feedback_view_', '');
                    await this.viewFeedbackDetails(chatId, messageId, feedbackId);
                }
                
                // ============ LUARMOR REPLY CALLBACKS ============
                else if (data.startsWith('luarmor_cancel_')) {
                    const reqId = data.replace('luarmor_cancel_', '');
                    const req = this.luarmorRequests[reqId];
                    if (req) {
                        // Reply to user's ORIGINAL link message
                        try {
                            await this.bot.sendMessage(req.chatId,
                                `<tg-emoji emoji-id="6269316311172518259">😭</tg-emoji> <b>𝖲𝖼𝗋𝗂𝗉𝗍 𝖡𝗒𝗉𝖺𝗌𝗌 𝖥𝖺𝗂𝗅𝖾𝖽: 𝖳𝗁𝗂𝗌 𝗌𝖼𝗋𝗂𝗉𝗍 𝖧𝖺𝗌 𝖠𝗅𝗋𝖾𝖺𝖽𝗒 𝖡𝖾𝖾𝗇 𝖳𝖺𝗄𝖾𝗇 𝗈𝗋 𝖢𝖺𝗇𝗇𝗈𝗍 𝖡𝖾 𝖡𝗒𝗉𝖺𝗌𝗌𝖾𝖽 𝖳𝗋𝗒 𝖠𝗇𝗈𝗍𝗁𝖾𝗋 𝖲𝖼𝗋𝗂𝗉𝗍 𝖪𝖾𝗒 𝖡𝗒𝗉𝖺𝗌𝗌</b>`,
                                { parse_mode: 'HTML', reply_to_message_id: req.originalUserMsgId }
                            );
                        } catch {}
                        // Delete the ⌛ Processing message
                        await this.bot.deleteMessage(req.chatId, req.messageId).catch(() => {});
                        delete this.luarmorRequests[reqId];
                    }
                    // Remove admin message buttons (mark as handled)
                    await this.bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
                        chat_id: chatId, message_id: messageId
                    }).catch(() => {});
                    await this.bot.answerCallbackQuery(callbackQuery.id, { text: '✅ Cancelled', show_alert: false });
                }
                else if (data.startsWith('luarmor_reply_')) {
                    const requestId = data.replace('luarmor_reply_', '');
                    await this.initLuarmorReply(chatId, messageId, requestId);
                }
                
                // ============ DEEP LINK CALLBACKS ============
                else if (data === 'admin_deeplink') {
                    await this.initDeepLinkCreation(chatId, messageId);
                }
                else if (data === 'admin_history') {
                    await this.showHistory(chatId, messageId);
                }
                else if (data === 'admin_clear_history') {
                    await this.clearHistory(chatId, messageId);
                }
                else if (data === 'deeplink_text') {
                    await this.setDeepLinkType(chatId, 'text', messageId);
                }
                else if (data === 'deeplink_photo') {
                    await this.setDeepLinkType(chatId, 'photo', messageId);
                }
                else if (data === 'deeplink_video') {
                    await this.setDeepLinkType(chatId, 'video', messageId);
                }
                else if (data === 'deeplink_document') {
                    await this.setDeepLinkType(chatId, 'document', messageId);
                }
                else if (data === 'deeplink_gif') {
                    await this.setDeepLinkType(chatId, 'gif', messageId);
                }
                else if (data === 'deeplink_poll') {
                    await this.setDeepLinkType(chatId, 'poll', messageId);
                }
                else if (data === 'deeplink_buttons') {
                    await this.startDeepLinkButtonWizard(chatId, messageId);
                }
                else if (data === 'deeplink_edit_text') {
                    await this.editDeepLinkText(chatId, messageId);
                }
                else if (data === 'deeplink_edit_caption') {
                    await this.editDeepLinkCaption(chatId, messageId);
                }
                else if (data === 'deeplink_add_copy') {
                    await this.addDeepLinkCopyButton(chatId, messageId);
                }
                else if (data === 'deeplink_preview') {
                    await this.previewDeepLink(chatId, messageId);
                }
                else if (data === 'deeplink_generate') {
                    await this.generateDeepLink(chatId, messageId);
                }
                else if (data === 'deeplink_cancel') {
                    await this.cancelDeepLink(chatId, messageId);
                }
                
                // ============ DEEP LINK BUTTON WIZARD CALLBACKS ============
                else if (data === 'deeplink_btn_style_primary' || data === 'deeplink_btn_style_success' || data === 'deeplink_btn_style_danger') {
                    await this.handleDeepLinkButtonStyle(chatId, messageId, data);
                }
                else if (data === 'deeplink_btn_emoji_skip') {
                    await this.handleDeepLinkButtonEmojiSkip(chatId, messageId);
                }
                else if (data === 'deeplink_btn_add_another') {
                    await this.deepLinkButtonAddAnother(chatId, messageId);
                }
                else if (data === 'deeplink_btn_done') {
                    await this.deepLinkButtonDone(chatId, messageId);
                }
                
                // ============ ADMIN PANEL CALLBACKS ============
                else if (data === 'admin_user_search') {
                    this.userSearchMode[chatId] = true;
                    const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
                    await this.bot.sendMessage(chatId,
                        `<tg-emoji emoji-id="5339141594471742013">🔍</tg-emoji> <b>${isEn ? 'User Search' : 'User ရှာဖွေရန်'}</b>\n\n` +
                        (isEn ? 'Send a <b>User ID</b> or <b>@username</b> to look up:' : '<b>User ID</b> သို့မဟုတ် <b>@username</b> ပို့ပါ:'),
                        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[
                            { text: isEn ? 'Cancel' : 'မလုပ်တော့', callback_data: 'admin_panel', icon_custom_emoji_id: '5258084656674250503', style: 'danger' }
                        ]]}}
                    );
                }
                else if (data === 'broadcast_last_stats') {
                    await this.bot.answerCallbackQuery(callbackQuery.id, { show_alert: false });
                    const s = this.lastBroadcastStats;
                    const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
                    if (!s) {
                        await this.bot.editMessageText(
                            `<tg-emoji emoji-id="5350618807943576963">📊</tg-emoji> <b>Broadcast Stats</b>\n\n` +
                            (isEn ? '❌ No broadcast sent yet.' : '❌ Broadcast မပို့ရသေးပါ'),
                            { chat_id: chatId, message_id: messageId, parse_mode: 'HTML',
                              reply_markup: { inline_keyboard: [[
                                { text: 'Admin Panel', callback_data: 'admin_panel', icon_custom_emoji_id: '6280276539430932448', style: 'success' }
                              ]]} }
                        ).catch(async () => {
                            await this.bot.sendMessage(chatId, isEn ? '❌ No broadcast sent yet.' : '❌ Broadcast မပို့ရသေးပါ');
                        });
                    } else {
                        const timeStr = new Date(s.time).toLocaleString('en-GB', { timeZone: 'Asia/Yangon' });
                        const txt =
                            `<tg-emoji emoji-id="5350618807943576963">📊</tg-emoji> <b>Last Broadcast Stats</b>\n\n` +
                            `<tg-emoji emoji-id="6053323501073341449">🕐</tg-emoji> <b>Time:</b> ${timeStr}\n` +
                            `<tg-emoji emoji-id="5368324170671202286">👥</tg-emoji> <b>Total:</b> <code>${s.totalUsers}</code>\n` +
                            `<tg-emoji emoji-id="6269163801178804220">✅</tg-emoji> <b>Sent:</b> <code>${s.successCount}</code>\n` +
                            `<tg-emoji emoji-id="5258084656674250503">❌</tg-emoji> <b>Failed:</b> <code>${s.failedCount}</code>\n` +
                            `<tg-emoji emoji-id="5339141594471742013">📈</tg-emoji> <b>Rate:</b> <code>${s.successRate}%</code>`;
                        await this.bot.editMessageText(txt, {
                            chat_id: chatId, message_id: messageId, parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: [[
                                { text: 'Admin Panel', callback_data: 'admin_panel', icon_custom_emoji_id: '6280276539430932448', style: 'success' }
                            ]]}
                        }).catch(async () => {
                            await this.bot.sendMessage(chatId, txt, { parse_mode: 'HTML' });
                        });
                    }
                }
                else if (data === 'admin_toggle_bypass') {
                    this.scriptBypassEnabled = !this.scriptBypassEnabled;
                    const status = this.scriptBypassEnabled ? 'ON' : 'OFF';
                    await this.bot.answerCallbackQuery(callbackQuery.id, {
                        text: `Script Key Bypass is now ${status}`,
                        show_alert: false
                    });
                    // Edit existing admin panel message (no new message)
                    await this.showAdminPanelEdit(chatId, userId.toString(), messageId);
                }
                else if (data === 'admin_panel') {
                    await this.showAdminPanel(chatId, userId);
                }
                else if (data === 'admin_back') {
                    // Delete current message and show new one
                    try {
                        await this.bot.deleteMessage(chatId, messageId);
                    } catch (error) {
                        console.error('Error deleting message:', error);
                    }
                    await this.showAdminPanel(chatId, userId);
                }
                else if (data === 'admin_cancel') {
                    delete this.setChannelMode[chatId];
                    try {
                        await this.bot.deleteMessage(chatId, messageId);
                    } catch (error) {
                        console.error('Error deleting message:', error);
                    }
                }
                else if (data === 'admin_set_channel') {
                    await this.initSetChannel(chatId, messageId);
                }
                else if (data === 'admin_channel_info') {
                    await this.showChannelInfo(chatId, messageId);
                }
                else if (data === 'admin_create_post') {
                    await this.initPostCreation(chatId, messageId);
                }
                else if (data.startsWith('select_channel_')) {
                    const channelId = data.replace('select_channel_', '');
                    await this.selectChannelAndCreatePost(chatId, messageId, channelId);
                }
                else if (data === 'admin_broadcast') {
                    await this.initBroadcast(chatId, messageId);
                }
                else if (data === 'admin_stats') {
                    await this.showAdminStats(chatId, messageId);
                }
                else if (data === 'admin_support') {
                    await this.showSupportedDomains(chatId, messageId);
                }
                else if (data === 'admin_help') {
                    await this.showAdminHelp(chatId, messageId);
                }
                else if (data === 'admin_users') {
                    await this.showUserList(chatId, messageId, 0);
                }
                else if (data.startsWith('admin_users_page_')) {
                    const page = parseInt(data.replace('admin_users_page_', ''));
                    await this.showUserList(chatId, messageId, page);
                }
                else if (data === 'admin_ban') {
                    await this.showBanManagement(chatId, messageId);
                }
                else if (data === 'admin_ban_user') {
                    await this.initBanUser(chatId, messageId);
                }
                else if (data.startsWith('ban_user_')) {
                    const targetId = data.replace('ban_user_', '');
                    this.banUser(targetId, 'Banned by admin');
                    await this.bot.answerCallbackQuery(callbackQuery.id, { text: `🚫 User ${targetId} banned.`, show_alert: true });
                }
                else if (data.startsWith('unban_user_')) {
                    const targetId = data.replace('unban_user_', '');
                    this.unbanUser(targetId);
                    await this.bot.answerCallbackQuery(callbackQuery.id, { text: `✅ User ${targetId} unbanned.`, show_alert: true });
                }
                else if (data === 'admin_unban_user') {
                    await this.initUnbanUser(chatId, messageId);
                }
                else if (data === 'admin_ban_list') {
                    await this.showBanList(chatId, messageId);
                }
                
                // ============ USER CALLBACKS ============
                else if (data === 'language') {
                    await this._deleteMsg(chatId, messageId);
                    await this.showLanguageOptions(chatId, null);
                } 
                else if (data === 'support') {
                    await this._deleteMsg(chatId, messageId);
                    await this.showSupportedDomainsNew(chatId);
                }
                else if (data === 'lang_en') {
                    this.userLanguages[chatId] = 'en';
                    await this._deleteMsg(chatId, messageId);
                    await this.bot.sendMessage(chatId,
                        `<tg-emoji emoji-id="6327717992268301521">✅</tg-emoji> <b>Language set to English!</b>\n<i>Menu will appear in English.</i>`,
                        { parse_mode: 'HTML' }
                    );
                    await this.sendWelcomeMessage(chatId, userId, user.username || 'N/A', user.first_name || 'User');
                }
                else if (data === 'lang_mm') {
                    this.userLanguages[chatId] = 'mm';
                    await this._deleteMsg(chatId, messageId);
                    await this.bot.sendMessage(chatId,
                        `<tg-emoji emoji-id="6327717992268301521">✅</tg-emoji> <b>ဘာသာစကား မြန်မာသို့ ပြောင်းလဲပြီ!</b>\n<i>Menu မြန်မာဘာသာဖြင့် ပြပေးမည်</i>`,
                        { parse_mode: 'HTML' }
                    );
                    await this.sendWelcomeMessage(chatId, userId, user.username || 'N/A', user.first_name || 'User');
                }
                else if (data === 'back_menu') {
                    // Delete current message and show new one
                    try {
                        await this.bot.deleteMessage(chatId, messageId);
                    } catch (error) {
                        console.error('Error deleting message:', error);
                    }
                    await this.goBackToMenu(chatId, messageId, user);
                }
                else if (data === 'lookup_my_ip') {
                    await this.bot.answerCallbackQuery(callbackQuery.id, { show_alert: false });
                    const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
                    const fakeMsg = { chat: { id: chatId }, from: { id: userId }, message_id: messageId };
                    // Re-trigger /ip with no target (my IP)
                    try {
                        const r = await axios.get('https://ipapi.co/json/', { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                        const d = r.data;
                        const txt =
                            `<tg-emoji emoji-id="5350618807943576963">⚡</tg-emoji> <b>My IP Lookup</b>\n\n` +
                            `<tg-emoji emoji-id="6339280615459789282">🌐</tg-emoji> <b>IP:</b> <code>${d.ip}</code>\n` +
                            `<tg-emoji emoji-id="5368324170671202286">📍</tg-emoji> <b>Country:</b> ${d.country_name} (${d.country_code})\n` +
                            `<tg-emoji emoji-id="5339141594471742013">🏙</tg-emoji> <b>City:</b> ${d.city || '-'}, ${d.region || '-'}\n` +
                            `<tg-emoji emoji-id="5258084656674250503">🔌</tg-emoji> <b>ISP:</b> ${d.org || '-'}\n` +
                            `<tg-emoji emoji-id="6053323501073341449">🕐</tg-emoji> <b>Timezone:</b> ${d.timezone || '-'}`;
                        await this.bot.sendMessage(chatId, txt, { parse_mode: 'HTML' });
                    } catch { await this.bot.sendMessage(chatId, '❌ IP lookup failed.'); }
                }
                else if (data === 'qr_gen_prompt') {
                    const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
                    await this.bot.answerCallbackQuery(callbackQuery.id, { show_alert: false });
                    await this.bot.sendMessage(chatId,
                        `<tg-emoji emoji-id="5260450573768990626">➡️</tg-emoji> ${isEn ? 'Send text or URL for QR:\n<code>/qr your text here</code>' : 'QR ထုတ်ရန် text/URL ပေးပို့ပါ:\n<code>/qr your text here</code>'}`,
                        { parse_mode: 'HTML' }
                    );
                }
                else if (data === 'bypass_copied_ack') {
                    await this.bot.answerCallbackQuery(callbackQuery.id, { text: '✈️ Copied!', show_alert: false });
                }
                else if (data === 'check_join') {
                    await this.bot.answerCallbackQuery(callbackQuery.id, { show_alert: false });
                    const isGroup2 = callbackQuery.message.chat.type !== 'private';

                    if (!isGroup2) {
                        // Private: delete join msg + show welcome
                        await this.bot.deleteMessage(chatId, messageId).catch(() => {});
                        await this.sendWelcomeMessage(chatId, userId, user.username || 'N/A', user.first_name || 'User');
                    } else {
                        // Group: check membership
                        const missingChannels = await this.checkChannelMembership(userId);
                        if (missingChannels.length > 0) {
                            // Still not joined - update join msg (keep as reply)
                            await this.showJoinRequiredMessage(chatId, missingChannels, messageId);
                        } else {
                            // Joined! Cancel auto-delete timer + delete join msg only
                            const timerKey2 = `${userId}_${chatId}`;
                            if (this.joinMsgTimers[timerKey2]) {
                                clearTimeout(this.joinMsgTimers[timerKey2]);
                                delete this.joinMsgTimers[timerKey2];
                            }
                            await this.bot.deleteMessage(chatId, messageId).catch(() => {});
                            // Resume pending bypass
                            if (this.pendingBypassRequests[userId]) {
                                const pending = this.pendingBypassRequests[userId];
                                delete this.pendingBypassRequests[userId];
                                // Keep user's original msg, bypass with reply
                                await this.processBypassRequest(pending.chatId, pending.url, pending.originalMessageId, userId);
                            } else if (this.pendingDeepLinks[userId]) {
                                const deepLinkId = this.pendingDeepLinks[userId];
                                delete this.pendingDeepLinks[userId];
                                await this.handleDeepLinkStart(chatId, userId, deepLinkId, null);
                            }
                        }
                    }
                }
                else if (data === 'refresh_join') {
                    // Delete the join message
                    try {
                        await this.bot.deleteMessage(chatId, messageId);
                    } catch (error) {
                        console.error('Error deleting refresh message:', error);
                    }
                    
                    // Force refresh join status
                    if (callbackQuery.message.chat.type === 'private') {
                        await this.sendWelcomeMessage(chatId, userId, user.username || 'N/A', user.first_name || 'User');
                    } else {
                        await this.forceCheckJoinStatus(chatId, userId);
                    }
                }
                else if (data === 'script_key_bypass') {
                    // Check if bypass is enabled
                    if (!this.scriptBypassEnabled) {
                        await this.bot.answerCallbackQuery(callbackQuery.id, { show_alert: false });
                        await this.bot.sendMessage(chatId,
                            `<tg-emoji emoji-id="6269316311172518259">😭</tg-emoji> <b>𝖲𝖼𝗋𝗂𝗉𝗍 𝖪𝖾𝗒 𝖡𝗒𝗉𝖺𝗌𝗌 𝖭𝗈𝗍 𝗒𝖾𝗍 𝖠𝗏𝖺𝗂𝗅𝖺𝖻𝗅𝖾, 𝖴𝗇𝖽𝖾𝗋 𝖱𝖾𝗉𝖺𝗂𝗋</b>`,
                            { parse_mode: 'HTML' }
                        );
                        return;
                    }
                    // Check join status before allowing bypass (private & group both)
                    const missingJoinChannels = await this.checkChannelMembership(userId);
                    if (missingJoinChannels.length > 0) {
                        await this.showJoinRequiredMessage(chatId, missingJoinChannels, messageId);
                        return;
                    }
                    await this.bot.sendMessage(chatId, `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> 𝖲𝖾𝗇𝖽 𝗒𝗈𝗎𝗋 𝖲𝖼𝗋𝗂𝗉𝗍 𝖪𝖾𝗒 𝗅𝗂𝗇𝗄 [𝖠𝖽𝗌 𝗅𝗎𝖺𝗋𝗆𝗈𝗋]`, { parse_mode: 'HTML' });
                }
                else if (data === 'song_menu') {
                    await this._deleteMsg(chatId, messageId);
                    await this.showSongMenu(chatId);
                }
                else if (data === 'song_tips') {
                    const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
                    await this.bot.answerCallbackQuery(callbackQuery.id, {
                        text: isEn
                            ? '💡 Tips: Be specific! Try "artist name + song title" for best results. Spotify & YouTube Music links work too!'
                            : '💡 Tips: Artist နာမည် + သီချင်းနာမည် တွဲရေးပါ။ Spotify / YouTube Music link လည်း အသုံးပြုနိုင်သည်!',
                        show_alert: true
                    });
                }
                else if (data === 'smartdl_menu') {
                    await this._deleteMsg(chatId, messageId);
                    await this.showSmartDlMenu(chatId);
                }
                else if (data === 'smartdl_how') {
                    await this.showSmartDlHowTo(chatId);
                }
                else if (data.startsWith('sdl_info_')) {
                    const platform = data.replace('sdl_info_', '');
                    const infos = {
                        tiktok:    { icon: '5350618807943576963', name: 'TikTok',     style: 'danger',  note: 'No watermark • HD quality • Audio download' },
                        instagram: { icon: '5368324170671202286', name: 'Instagram',  style: 'danger',  note: 'Reels • Posts • Carousel (first media)' },
                        twitter:   { icon: '5339141594471742013', name: 'Twitter/X',  style: 'primary', note: 'Videos • GIFs • Highest quality' },
                        facebook:  { icon: '5260450573768990626', name: 'Facebook',   style: 'primary', note: 'Public videos only • FB Watch supported' },
                        youtube:   { icon: '5258084656674250503', name: 'YouTube',    style: 'danger',  note: 'Up to 720p • Short clips work best' },
                    };
                    const info = infos[platform];
                    if (info) {
                        await this.bot.answerCallbackQuery(callbackQuery.id, {
                            text: `${info.name}: ${info.note}`, show_alert: true
                        });
                    }
                }
                                else if (data === 'catbox_menu') {
                    await this._deleteMsg(chatId, messageId);
                    await this.showCatboxMenu(chatId);
                }
                else if (data === 'catbox_upload_start') {
                    this.catboxWaiting[chatId] = true;
                    const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
                    await this.bot.sendMessage(chatId,
                        `<tg-emoji emoji-id="5260450573768990626">➡️</tg-emoji> ` +
                        (isEn
                            ? `<b>Send your file now</b>\n\nSupports: Photo, Video, Document, Audio\nMax size: ~200MB\n\n<i>Type /cancel to abort</i>`
                            : `<b>ဖိုင် ပေးပို့ပါ</b>\n\nPhoto, Video, Document, Audio ပေးပို့နိုင်သည်\nSize အများဆုံး: ~200MB\n\n<i>/cancel ရိုက်ပြီး ထွက်နိုင်သည်</i>`),
                        { parse_mode: 'HTML' }
                    );
                }
                else if (data === 'warp_generate') {
                    await this._deleteMsg(chatId, messageId);
                    await this.showWarpMenu(chatId);
                }
                else if (data === 'warp_how_to') {
                    await this.showWarpHowTo(chatId);
                }
                else if (data === 'warp_custom_ip') {
                    this.warpCustomIpWaiting[chatId] = true;
                    const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
                    await this.bot.sendMessage(chatId,
                        isEn
                            ? `✏️ <b>Enter Custom Endpoint</b>\n\nFormat: <code>IP:Port</code>\nExample: <code>162.159.192.5:2408</code>\nor just IP: <code>162.159.192.5</code> (default port 2408)\n\n<i>Type /cancel to abort</i>`
                            : `✏️ <b>Custom Endpoint ရိုက်ထည့်ပါ</b>\n\nပုံစံ: <code>IP:Port</code>\nဥပမာ: <code>162.159.192.5:2408</code>\nသို့မဟုတ် IP တစ်ခုတည်း: <code>162.159.192.5</code> (port 2408)\n\n<i>/cancel ရိုက်ပြီး ထွက်နိုင်သည်</i>`,
                        { parse_mode: 'HTML' }
                    );
                }
                else if (data.startsWith('warp_gen_')) {
                    // ALL endpoints force Port 500
                    const endpointMap = {
                        'warp_gen_default':  { ip: '162.159.192.1',   port: '500', label: 'Default',      count: 1  },
                        'warp_gen_mm1':      { ip: '162.159.192.1',   port: '500', label: 'MM-1',          count: 1  },
                        'warp_gen_mm2':      { ip: '162.159.192.2',   port: '500', label: 'MM-2',          count: 1  },
                        'warp_gen_mm3':      { ip: '162.159.192.3',   port: '500', label: 'MM-3',          count: 1  },
                        'warp_gen_193_1':    { ip: '162.159.193.1',   port: '500', label: '193.1',         count: 1  },
                        'warp_gen_188_1':    { ip: '188.114.96.1',    port: '500', label: '188.1',         count: 1  },
                        'warp_gen_188_2':    { ip: '188.114.97.1',    port: '500', label: '188.2',         count: 1  },
                        'warp_gen_p443':     { ip: '162.159.193.1',   port: '500', label: 'Port 500',      count: 1  },
                        'warp_gen_p2408':    { ip: '188.114.96.1',    port: '500', label: 'Port 500',      count: 1  },
                        'warp_gen_p500':     { ip: '162.159.192.1',   port: '500', label: 'Port 500',      count: 1  },
                        'warp_gen_p1701':    { ip: '162.159.193.1',   port: '500', label: 'Port 500',      count: 1  },
                        'warp_gen_multi3':   { ip: '162.159.192.1',   port: '500', label: 'Multi x3',     count: 3  },
                        'warp_gen_multi5':   { ip: '162.159.192.2',   port: '500', label: 'Multi x5',     count: 5  },
                        'warp_gen_multi10':  { ip: '162.159.192.3',   port: '500', label: 'Multi x10',    count: 10 },
                    };
                    const ep = endpointMap[data] || endpointMap['warp_gen_default'];
                    await this.execWarpGeneration(chatId, ep.ip, ep.port, ep.label, ep.count);
                }
                
                // ============ BROADCAST CALLBACKS ============
                else if (data === 'broadcast_text') {
                    await this.setBroadcastType(chatId, 'text', messageId);
                }
                else if (data === 'broadcast_photo') {
                    await this.setBroadcastType(chatId, 'photo', messageId);
                }
                else if (data === 'broadcast_video') {
                    await this.setBroadcastType(chatId, 'video', messageId);
                }
                else if (data === 'broadcast_document') {
                    await this.setBroadcastType(chatId, 'document', messageId);
                }
                else if (data === 'broadcast_gif') {
                    await this.setBroadcastType(chatId, 'gif', messageId);
                }
                else if (data === 'broadcast_sticker') {
                    await this.setBroadcastType(chatId, 'sticker', messageId);
                }
                else if (data === 'broadcast_buttons') {
                    await this.startBroadcastButtonWizard(chatId, messageId);
                }
                else if (data === 'broadcast_edit_text') {
                    await this.editBroadcastText(chatId, messageId);
                }
                else if (data === 'broadcast_edit_caption') {
                    await this.editBroadcastCaption(chatId, messageId);
                }
                else if (data === 'broadcast_preview') {
                    await this.previewBroadcast(chatId, messageId);
                }
                else if (data === 'broadcast_send') {
                    await this.sendBroadcast(chatId, messageId);
                }
                else if (data === 'broadcast_cancel') {
                    await this.cancelBroadcast(chatId, messageId);
                }
                
                // ============ BROADCAST BUTTON WIZARD CALLBACKS ============
                else if (data === 'broadcast_btn_type_url' || data === 'broadcast_btn_type_copy') {
                    await this.handleBroadcastButtonType(chatId, messageId, data);
                }
                else if (data === 'broadcast_btn_style_primary' || data === 'broadcast_btn_style_success' || data === 'broadcast_btn_style_danger') {
                    await this.handleBroadcastButtonStyle(chatId, messageId, data);
                }
                else if (data === 'broadcast_btn_emoji_skip') {
                    await this.handleBroadcastButtonEmojiSkip(chatId, messageId);
                }
                else if (data === 'broadcast_btn_add_another') {
                    await this.broadcastButtonAddAnother(chatId, messageId);
                }
                else if (data === 'broadcast_btn_done') {
                    await this.broadcastButtonDone(chatId, messageId);
                }
                
                // ============ POST CREATION CALLBACKS ============
                else if (data === 'post_text') {
                    await this.setPostType(chatId, 'text', messageId);
                }
                else if (data === 'post_photo') {
                    await this.setPostType(chatId, 'photo', messageId);
                }
                else if (data === 'post_video') {
                    await this.setPostType(chatId, 'video', messageId);
                }
                else if (data === 'post_document') {
                    await this.setPostType(chatId, 'document', messageId);
                }
                else if (data === 'post_gif') {
                    await this.setPostType(chatId, 'gif', messageId);
                }
                else if (data === 'post_poll') {
                    await this.setPostType(chatId, 'poll', messageId);
                }
                else if (data === 'post_buttons') {
                    await this.startPostButtonWizard(chatId, messageId);
                }
                else if (data === 'post_edit_text') {
                    await this.editPostText(chatId, messageId);
                }
                else if (data === 'post_edit_caption') {
                    await this.editPostCaption(chatId, messageId);
                }
                else if (data === 'post_add_copy') {
                    await this.initPostCopyButton(chatId, messageId);
                }
                else if (data === 'post_emoji_content') {
                    await this.showEmojiPicker(chatId, messageId, 'content');
                }
                else if (data === 'post_emoji_caption') {
                    await this.showEmojiPicker(chatId, messageId, 'caption');
                }
                else if (data.startsWith('emoji_')) {
                    const parts = data.split('_');
                    const target = parts[1]; // content or caption
                    const emoji = parts.slice(2).join('_'); // handle emoji with underscores?
                    const postData = this.postData[chatId];
                    if (postData) {
                        await this.handleEmojiPick(chatId, messageId, target, emoji, postData);
                    }
                }
                else if (data === 'post_back_to_edit') {
                    // Return to post edit menu
                    const postData = this.postData[chatId];
                    if (!postData) return;
                    const keyboard = [
                        [
                            { text: "🔗 ခလုတ်များ ထည့်ရန်", callback_data: "post_buttons" },
                            { text: "📝 စာသား ပြင်ရန်", callback_data: "post_edit_text" }
                        ],
                        [
                            { text: "😀 Emoji", callback_data: "post_emoji_content" },
                            { text: "📋 Copy Button", callback_data: "post_add_copy" }
                        ],
                        [
                            { text: "👁️ ကြိုတင်ကြည့်ရန်", callback_data: "post_preview" },
                            { text: "🚀 ယခုတင်ရန်", callback_data: "post_publish" }
                        ],
                        [
                            { text: "❌ ပယ်ဖျက်ရန်", callback_data: "post_cancel" }
                        ]
                    ];
                    await this.bot.editMessageText("✅ ပို့စ်အား ဆက်လက်တည်းဖြတ်ပါ:", {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: keyboard }
                    });
                    this.messageTypes[messageId] = 'text';
                }
                else if (data === 'post_check_perms') {
                    await this.checkAndShowChannelPermissions(chatId, messageId);
                }
                else if (data === 'post_preview') {
                    await this.previewPost(chatId, messageId);
                }
                else if (data === 'post_publish') {
                    await this.publishPost(chatId, messageId);
                }
                else if (data === 'post_cancel') {
                    await this.cancelPost(chatId, messageId);
                }
                
                // ============ POST BUTTON WIZARD CALLBACKS ============
                else if (data === 'post_btn_style_primary' || data === 'post_btn_style_success' || data === 'post_btn_style_danger') {
                    await this.handlePostButtonStyle(chatId, messageId, data);
                }
                else if (data === 'post_btn_emoji_skip') {
                    await this.handlePostButtonEmojiSkip(chatId, messageId);
                }
                else if (data === 'post_btn_add_another') {
                    await this.postButtonAddAnother(chatId, messageId);
                }
                else if (data === 'post_btn_done') {
                    await this.postButtonDone(chatId, messageId);
                }
                
                // ============ NEW: Unmute callback ============
                else if (data.startsWith('unmute_')) {
                    const parts = data.split('_');
                    if (parts.length === 3) {
                        const groupId = parts[1];
                        const targetUserId = parts[2];
                        await this.unmuteUser(groupId, targetUserId, userId);
                    }
                }
            } catch (error) {
                console.error('❌ Callback error:', error);
                try {
                    await this.bot.answerCallbackQuery(callbackQuery.id, {
                        text: '❌ Error processing request',
                        show_alert: true
                    });
                } catch (e) {
                    console.error('Error answering callback:', e);
                }
            }
        });

        // Error handler
        this.bot.on('polling_error', (error) => {
            console.error('Polling error:', error);
        });
    }

    // ==================== BUTTON WIZARD METHODS FOR POST ====================
    async startPostButtonWizard(chatId, messageId) {
        const data = this.postData[chatId];
        if (!data) return;
        
        // Initialize wizard state
        this.postButtonWizard[chatId] = {
            step: 'text', // 'text', 'data', 'style', 'emoji'
            buttons: data.buttons || [], // existing buttons (if any)
            currentButton: {}
        };
        
        await this.bot.editMessageText("➕ <b>Add a new button</b>\n\nPlease enter the button text:", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel Wizard", callback_data: "post_cancel" }]
                ]
            }
        });
        this.messageTypes[messageId] = 'text';
        
        // Set waitingFor to capture button text in message handler
        // We'll use the wizard state instead of waitingFor, but we need to differentiate from other inputs.
        // We'll add a new state variable: this.waitingForButtonText[chatId] = true
        // But for simplicity, we can use the wizard step. In message handler, we need to check if wizard exists and step is 'text'.
    }

    // In message handler, we need to add a block for button wizard steps.
    // We'll add after the broadcast/post/deeplink mode checks.

    // We'll implement the wizard step handlers as separate methods.
    async handlePostButtonText(chatId, text) {
        const wizard = this.postButtonWizard[chatId];
        if (!wizard) return false;
        
        wizard.currentButton.text = text;
        wizard.step = 'data';
        
        await this.bot.sendMessage(chatId, "🔗 <b>Enter button data</b>\n\n" +
            "• For URL: send full URL (https://...)\n" +
            "• For copy: send <code>copy:text to copy</code>\n" +
            "• For callback: send any text (will be used as callback_data)", {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel Wizard", callback_data: "post_cancel" }]
                ]
            }
        });
        return true;
    }

    async handlePostButtonData(chatId, text) {
        const wizard = this.postButtonWizard[chatId];
        if (!wizard) return false;
        
        wizard.currentButton.data = text;
        wizard.step = 'style';
        
        await this.bot.sendMessage(chatId, "🎨 <b>Choose button style</b>", {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🔵 Primary", callback_data: "post_btn_style_primary" },
                        { text: "🟢 Success", callback_data: "post_btn_style_success" },
                        { text: "🔴 Danger", callback_data: "post_btn_style_danger" }
                    ]
                ]
            }
        });
        return true;
    }

    async handlePostButtonStyle(chatId, messageId, data) {
        const wizard = this.postButtonWizard[chatId];
        if (!wizard) return;
        
        let style = '';
        if (data === 'post_btn_style_primary') style = 'primary';
        else if (data === 'post_btn_style_success') style = 'success';
        else if (data === 'post_btn_style_danger') style = 'danger';
        
        wizard.currentButton.style = style;
        wizard.step = 'emoji';
        
        await this.bot.editMessageText("😀 <b>Custom emoji</b>\n\nSend custom emoji ID (numbers only) or press Skip:", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "⏭️ Skip", callback_data: "post_btn_emoji_skip" }],
                    [{ text: "❌ Cancel Wizard", callback_data: "post_cancel" }]
                ]
            }
        });
        this.messageTypes[messageId] = 'text';
    }

    async handlePostButtonEmoji(chatId, text) {
        const wizard = this.postButtonWizard[chatId];
        if (!wizard) return false;
        
        if (/^\d+$/.test(text)) {
            wizard.currentButton.emojiId = text;
        }
        // else ignore (invalid ID)
        
        await this.finalizePostButton(chatId);
        return true;
    }

    async handlePostButtonEmojiSkip(chatId, messageId) {
        const wizard = this.postButtonWizard[chatId];
        if (!wizard) return;
        
        await this.finalizePostButton(chatId);
    }

    async finalizePostButton(chatId) {
        const wizard = this.postButtonWizard[chatId];
        if (!wizard) return;
        
        // Build button object
        const btn = { text: wizard.currentButton.text };
        const btnType = wizard.currentButton.type || 'url';
        const data = wizard.currentButton.data || '';
        
        if (btnType === 'copy') {
            // copy_text button - style allowed (success = green, primary = blue, danger = red)
            btn.copy_text = { text: data };
        } else if (data.startsWith('http') || data.startsWith('tg://')) {
            btn.url = data;
        } else if (data.startsWith('copy:')) {
            btn.copy_text = { text: data.substring(5) };
        } else {
            btn.callback_data = data || 'noop';
        }
        
        if (wizard.currentButton.style) {
            btn.style = wizard.currentButton.style;
        }
        if (wizard.currentButton.emojiId) {
            btn.icon_custom_emoji_id = wizard.currentButton.emojiId;
        }
        
        // Add to list
        wizard.buttons.push([btn]); // each button as its own row
        
        // Ask for next action
        await this.bot.sendMessage(chatId, `✅ Button added!\n\n<b>Current buttons:</b> ${wizard.buttons.length}`, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "➕ Add another", callback_data: "post_btn_add_another" },
                        { text: "✅ Done", callback_data: "post_btn_done" }
                    ],
                    [{ text: "❌ Cancel Wizard", callback_data: "post_cancel" }]
                ]
            }
        });
        
        // Reset current button but keep wizard
        wizard.currentButton = {};
        wizard.step = null; // waiting for choice
    }

    async postButtonAddAnother(chatId, messageId) {
        const wizard = this.postButtonWizard[chatId];
        if (!wizard) return;
        
        wizard.step = 'text';
        await this.bot.editMessageText("➕ <b>Add another button</b>\n\nPlease enter the button text:", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel Wizard", callback_data: "post_cancel" }]
                ]
            }
        });
        this.messageTypes[messageId] = 'text';
    }

    async postButtonDone(chatId, messageId) {
        const wizard = this.postButtonWizard[chatId];
        if (!wizard) return;
        
        // Save buttons to postData
        const data = this.postData[chatId];
        if (data) {
            data.buttons = wizard.buttons;
        }
        
        // Clear wizard
        delete this.postButtonWizard[chatId];
        
        // Return to post edit menu
        const keyboard = [
            [
                { text: "🔗 ခလုတ်များ ထည့်ရန်", callback_data: "post_buttons" },
                { text: "📝 စာသား ပြင်ရန်", callback_data: "post_edit_text" }
            ],
            [
                { text: "😀 Emoji", callback_data: "post_emoji_content" },
                { text: "📋 Copy Button", callback_data: "post_add_copy" }
            ],
            [
                { text: "👁️ ကြိုတင်ကြည့်ရန်", callback_data: "post_preview" },
                { text: "🚀 ယခုတင်ရန်", callback_data: "post_publish" }
            ],
            [
                { text: "❌ ပယ်ဖျက်ရန်", callback_data: "post_cancel" }
            ]
        ];
        
        await this.bot.editMessageText("✅ Buttons saved! You can continue editing.", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
        this.messageTypes[messageId] = 'text';
    }

    // ==================== BUTTON WIZARD METHODS FOR BROADCAST ====================
    async startBroadcastButtonWizard(chatId, messageId) {
        const data = this.broadcastData[chatId];
        if (!data) return;
        
        this.broadcastButtonWizard[chatId] = {
            step: 'text',
            buttons: data.buttons || [],
            currentButton: {}
        };
        
        await this.bot.editMessageText("➕ <b>Add a new button</b>\n\nPlease enter the button text:", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel Wizard", callback_data: "broadcast_cancel" }]
                ]
            }
        });
        this.messageTypes[messageId] = 'text';
    }

    async handleBroadcastButtonText(chatId, text) {
        const wizard = this.broadcastButtonWizard[chatId];
        if (!wizard) return false;
        
        wizard.currentButton.text = text;
        wizard.step = 'type';
        
        await this.bot.sendMessage(chatId, "🔘 <b>Choose button type:</b>", {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🔗 URL Link", callback_data: "broadcast_btn_type_url" },
                        { text: "📋 Copy Text", callback_data: "broadcast_btn_type_copy" }
                    ],
                    [{ text: "❌ Cancel", callback_data: "broadcast_cancel" }]
                ]
            }
        });
        return true;
    }

    async handleBroadcastButtonData(chatId, text) {
        const wizard = this.broadcastButtonWizard[chatId];
        if (!wizard) return false;
        
        wizard.currentButton.data = text;

        if (wizard.currentButton.type === 'copy') {
            // Copy button → skip to style directly (no url needed)
            wizard.step = 'style';
        } else {
            wizard.step = 'style';
        }
        
        await this.bot.sendMessage(chatId, "🎨 <b>Choose button color</b>", {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🔵 Primary", callback_data: "broadcast_btn_style_primary" },
                        { text: "🟢 Success", callback_data: "broadcast_btn_style_success" },
                        { text: "🔴 Danger", callback_data: "broadcast_btn_style_danger" }
                    ]
                ]
            }
        });
        return true;
    }

    async handleBroadcastButtonType(chatId, messageId, data) {
        const wizard = this.broadcastButtonWizard[chatId];
        if (!wizard) return;
        
        wizard.currentButton.type = data === 'broadcast_btn_type_copy' ? 'copy' : 'url';
        wizard.step = 'data';
        
        const prompt = wizard.currentButton.type === 'copy'
            ? "📋 <b>Enter the text to copy:</b>\n\nUsers will copy this text when they press the button."
            : "🔗 <b>Enter the URL:</b>\n\nSend full URL (https://...)";
        
        await this.bot.editMessageText(prompt, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "broadcast_cancel" }]] }
        }).catch(async () => {
            await this.bot.sendMessage(chatId, prompt, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "broadcast_cancel" }]] }
            });
        });
    }

    async handleBroadcastButtonStyle(chatId, messageId, data) {
        const wizard = this.broadcastButtonWizard[chatId];
        if (!wizard) return;
        
        let style = '';
        if (data === 'broadcast_btn_style_primary') style = 'primary';
        else if (data === 'broadcast_btn_style_success') style = 'success';
        else if (data === 'broadcast_btn_style_danger') style = 'danger';
        
        wizard.currentButton.style = style;
        wizard.step = 'emoji';
        
        await this.bot.editMessageText("😀 <b>Custom emoji</b>\n\nSend custom emoji ID (numbers only) or press Skip:", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "⏭️ Skip", callback_data: "broadcast_btn_emoji_skip" }],
                    [{ text: "❌ Cancel Wizard", callback_data: "broadcast_cancel" }]
                ]
            }
        });
        this.messageTypes[messageId] = 'text';
    }

    async handleBroadcastButtonEmoji(chatId, text) {
        const wizard = this.broadcastButtonWizard[chatId];
        if (!wizard) return false;
        
        if (/^\d+$/.test(text)) {
            wizard.currentButton.emojiId = text;
        }
        
        await this.finalizeBroadcastButton(chatId);
        return true;
    }

    async handleBroadcastButtonEmojiSkip(chatId, messageId) {
        const wizard = this.broadcastButtonWizard[chatId];
        if (!wizard) return;
        
        await this.finalizeBroadcastButton(chatId);
    }

    async finalizeBroadcastButton(chatId) {
        const wizard = this.broadcastButtonWizard[chatId];
        if (!wizard) return;
        
        const btn = { text: wizard.currentButton.text };
        const data = wizard.currentButton.data;
        
        if (data.startsWith('http') || data.startsWith('tg://')) {
            btn.url = data;
        } else if (data.startsWith('copy:')) {
            btn.copy_text = { text: data.substring(5) };
        } else {
            btn.callback_data = data;
        }
        
        if (wizard.currentButton.style) {
            btn.style = wizard.currentButton.style;
        }
        if (wizard.currentButton.emojiId) {
            btn.icon_custom_emoji_id = wizard.currentButton.emojiId;
        }
        
        wizard.buttons.push([btn]); // each button as its own row
        
        await this.bot.sendMessage(chatId, `✅ Button added!\n\n<b>Current buttons:</b> ${wizard.buttons.length}`, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "➕ Add another", callback_data: "broadcast_btn_add_another" },
                        { text: "✅ Done", callback_data: "broadcast_btn_done" }
                    ],
                    [{ text: "❌ Cancel Wizard", callback_data: "broadcast_cancel" }]
                ]
            }
        });
        
        wizard.currentButton = {};
        wizard.step = null;
    }

    async broadcastButtonAddAnother(chatId, messageId) {
        const wizard = this.broadcastButtonWizard[chatId];
        if (!wizard) return;
        
        wizard.step = 'text';
        await this.bot.editMessageText("➕ <b>Add another button</b>\n\nPlease enter the button text:", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel Wizard", callback_data: "broadcast_cancel" }]
                ]
            }
        });
        this.messageTypes[messageId] = 'text';
    }

    async broadcastButtonDone(chatId, messageId) {
        const wizard = this.broadcastButtonWizard[chatId];
        if (!wizard) return;
        
        const data = this.broadcastData[chatId];
        if (data) {
            data.buttons = wizard.buttons;
        }
        
        delete this.broadcastButtonWizard[chatId];
        
        const keyboard = [
            [
                { text: "🔗 ခလုတ်များ ထည့်ရန်", callback_data: "broadcast_buttons" },
                { text: "📝 စာသား ပြင်ရန်", callback_data: "broadcast_edit_text" }
            ],
            [
                { text: "👁️ ကြိုတင်ကြည့်ရန်", callback_data: "broadcast_preview" },
                { text: "🚀 ယခုပို့ရန်", callback_data: "broadcast_send" }
            ],
            [
                { text: "❌ ပယ်ဖျက်ရန်", callback_data: "broadcast_cancel" }
            ]
        ];
        
        await this.bot.editMessageText("✅ Buttons saved! You can continue editing.", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
        this.messageTypes[messageId] = 'text';
    }

    // ==================== BUTTON WIZARD METHODS FOR DEEP LINK ====================
    async startDeepLinkButtonWizard(chatId, messageId) {
        const data = this.deepLinkData[chatId];
        if (!data) return;
        
        this.deepLinkButtonWizard[chatId] = {
            step: 'text',
            buttons: data.buttons || [],
            currentButton: {}
        };
        
        await this.bot.editMessageText("➕ <b>Add a new button</b>\n\nPlease enter the button text:", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel Wizard", callback_data: "deeplink_cancel" }]
                ]
            }
        });
        this.messageTypes[messageId] = 'text';
    }

    async handleDeepLinkButtonText(chatId, text) {
        const wizard = this.deepLinkButtonWizard[chatId];
        if (!wizard) return false;
        
        wizard.currentButton.text = text;
        wizard.step = 'data';
        
        await this.bot.sendMessage(chatId, "🔗 <b>Enter button data</b>\n\n" +
            "• For URL: send full URL (https://...)\n" +
            "• For copy: send <code>copy:text to copy</code>\n" +
            "• For callback: send any text (will be used as callback_data)", {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel Wizard", callback_data: "deeplink_cancel" }]
                ]
            }
        });
        return true;
    }

    async handleDeepLinkButtonData(chatId, text) {
        const wizard = this.deepLinkButtonWizard[chatId];
        if (!wizard) return false;
        
        wizard.currentButton.data = text;
        wizard.step = 'style';
        
        await this.bot.sendMessage(chatId, "🎨 <b>Choose button style</b>", {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🔵 Primary", callback_data: "deeplink_btn_style_primary" },
                        { text: "🟢 Success", callback_data: "deeplink_btn_style_success" },
                        { text: "🔴 Danger", callback_data: "deeplink_btn_style_danger" }
                    ]
                ]
            }
        });
        return true;
    }

    async handleDeepLinkButtonStyle(chatId, messageId, data) {
        const wizard = this.deepLinkButtonWizard[chatId];
        if (!wizard) return;
        
        let style = '';
        if (data === 'deeplink_btn_style_primary') style = 'primary';
        else if (data === 'deeplink_btn_style_success') style = 'success';
        else if (data === 'deeplink_btn_style_danger') style = 'danger';
        
        wizard.currentButton.style = style;
        wizard.step = 'emoji';
        
        await this.bot.editMessageText("😀 <b>Custom emoji</b>\n\nSend custom emoji ID (numbers only) or press Skip:", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "⏭️ Skip", callback_data: "deeplink_btn_emoji_skip" }],
                    [{ text: "❌ Cancel Wizard", callback_data: "deeplink_cancel" }]
                ]
            }
        });
        this.messageTypes[messageId] = 'text';
    }

    async handleDeepLinkButtonEmoji(chatId, text) {
        const wizard = this.deepLinkButtonWizard[chatId];
        if (!wizard) return false;
        
        if (/^\d+$/.test(text)) {
            wizard.currentButton.emojiId = text;
        }
        
        await this.finalizeDeepLinkButton(chatId);
        return true;
    }

    async handleDeepLinkButtonEmojiSkip(chatId, messageId) {
        const wizard = this.deepLinkButtonWizard[chatId];
        if (!wizard) return;
        
        await this.finalizeDeepLinkButton(chatId);
    }

    async finalizeDeepLinkButton(chatId) {
        const wizard = this.deepLinkButtonWizard[chatId];
        if (!wizard) return;
        
        const btn = { text: wizard.currentButton.text };
        const data = wizard.currentButton.data;
        
        if (data.startsWith('http') || data.startsWith('tg://')) {
            btn.url = data;
        } else if (data.startsWith('copy:')) {
            btn.copy_text = { text: data.substring(5) };
        } else {
            btn.callback_data = data;
        }
        
        if (wizard.currentButton.style) {
            btn.style = wizard.currentButton.style;
        }
        if (wizard.currentButton.emojiId) {
            btn.icon_custom_emoji_id = wizard.currentButton.emojiId;
        }
        
        wizard.buttons.push([btn]); // each button as its own row
        
        await this.bot.sendMessage(chatId, `✅ Button added!\n\n<b>Current buttons:</b> ${wizard.buttons.length}`, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "➕ Add another", callback_data: "deeplink_btn_add_another" },
                        { text: "✅ Done", callback_data: "deeplink_btn_done" }
                    ],
                    [{ text: "❌ Cancel Wizard", callback_data: "deeplink_cancel" }]
                ]
            }
        });
        
        wizard.currentButton = {};
        wizard.step = null;
    }

    async deepLinkButtonAddAnother(chatId, messageId) {
        const wizard = this.deepLinkButtonWizard[chatId];
        if (!wizard) return;
        
        wizard.step = 'text';
        await this.bot.editMessageText("➕ <b>Add another button</b>\n\nPlease enter the button text:", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel Wizard", callback_data: "deeplink_cancel" }]
                ]
            }
        });
        this.messageTypes[messageId] = 'text';
    }

    async deepLinkButtonDone(chatId, messageId) {
        const wizard = this.deepLinkButtonWizard[chatId];
        if (!wizard) return;
        
        const data = this.deepLinkData[chatId];
        if (data) {
            data.buttons = wizard.buttons;
        }
        
        delete this.deepLinkButtonWizard[chatId];
        
        const keyboard = [
            [
                { text: "👁️ ကြိုတင်ကြည့်ရန်", callback_data: "deeplink_preview" },
                { text: "🚀 Link Generate", callback_data: "deeplink_generate" }
            ],
            [
                { text: "🔗 Edit Layout", callback_data: "deeplink_buttons" },
                { text: "📝 Edit Text", callback_data: "deeplink_edit_text" }
            ],
            [
                { text: "❌ ပယ်ဖျက်ရန်", callback_data: "deeplink_cancel" }
            ]
        ];
        
        await this.bot.editMessageText("✅ Buttons saved! You can continue editing.", {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        });
        this.messageTypes[messageId] = 'text';
    }

    // ==================== SUPPORTED DOMAINS UPDATE ====================
    async updateSupportedDomainsFromAPI() {
        try {
            const response = await axios.get(`${this.apiBase}/supported`, {
                headers: {
                    'x-api-key': this.apiKey
                },
                timeout: 10000
            });

            if (response.data && response.data.result && Array.isArray(response.data.result)) {
                const newDomains = [];
                // API ရဲ့ structure အရ domain တွေကို စုစည်းမယ်
                for (const item of response.data.result) {
                    if (item.domains && Array.isArray(item.domains)) {
                        newDomains.push(...item.domains);
                    }
                }
                
                if (newDomains.length > 0) {
                    // ထပ်တူကျတာတွေကို ဖယ်ရှားပြီး စီမယ်
                    this.supportedDomains = [...new Set(newDomains)].sort();
                    console.log(`✅ Supported domains updated from API. Total: ${this.supportedDomains.length}`);
                } else {
                    console.log('⚠️ API returned empty domain list.');
                }
            }
        } catch (error) {
            console.error('Error updating supported domains from API:', error.message);
        }
    }

    // ==================== NEW METHOD: CLEANUP PAYMENT MODE ====================
    cleanupPaymentMode(chatId) {
        // Simply delete the payment mode flag
        delete this.paymentMode[chatId];
    }

    // ==================== LUARMOR DOMAIN HANDLING ====================

    async handleLuarmorRequest(chatId, url, originalMessageId, userId) {
        // Send processing message
        const processingMessage = await this.bot.sendMessage(chatId, 
            `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> Processing Script Key request...`,
            { 
                parse_mode: 'HTML',
                reply_to_message_id: originalMessageId
            }
        );

        // Generate unique request ID
        const requestId = this.generateDeepLinkId();
        
        // Store the request
        this.luarmorRequests[requestId] = {
            url: url,
            chatId: chatId,
            userId: userId,
            messageId: processingMessage.message_id,  // ⌛ processing msg to delete
            originalUserMsgId: originalMessageId,      // user's original link message
            timestamp: Date.now()
        };

        // Get user info
        try {
            const user = await this.bot.getChat(userId);
            const username = user.username || 'N/A';
            const firstName = user.first_name || 'User';

            // Send to admin with distinct button text
            const adminMessage = `🆕 New Luarmor Key Bypass Request\n\n` +
                                `👤 User: ${firstName} (ID: ${userId})\n` +
                                `📛 Username: @${username}\n` +
                                `🔗 URL: ${url}\n` +
                                `🆔 Request ID: ${requestId}\n` +
                                `🕒 Time: ${this.formatMyanmarTime()}`;

            for (const adminId of this.adminIds) {
                await this.bot.sendMessage(adminId, adminMessage, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "User Profile",  url: `tg://user?id=${userId}`, icon_custom_emoji_id: "5368324170671202286", style: "primary" },
                                { text: "Reply",         callback_data: `luarmor_reply_${requestId}`,   icon_custom_emoji_id: "5339141594471742013", style: "success" }
                            ],
                            [
                                { text: "Copy Link",     copy_text: { text: url } },
                                { text: "Cancel",        callback_data: `luarmor_cancel_${requestId}`,  icon_custom_emoji_id: "5258084656674250503", style: "danger" }
                            ]
                        ]
                    }
                });
            }

        } catch (error) {
            console.error('Error handling luarmor request:', error);
        }
    }

    async initLuarmorReply(chatId, messageId, requestId) {
        const request = this.luarmorRequests[requestId];
        
        if (!request) {
            await this.bot.sendMessage(chatId, "❌ Request not found or expired.");
            return;
        }

        this.feedbackWaitingForReply[chatId] = {
            type: 'luarmor_reply',
            requestId: requestId,
            userId: request.userId,
            messageId: request.messageId
        };

        // Send message to admin
        await this.bot.sendMessage(chatId, 
            `💬 <b>Replying to Luarmor User</b>\n\n` +
            `User ID: <code>${request.userId}</code>\n` +
            `URL: <code>${request.url}</code>\n` +
            `Request ID: ${requestId}\n\n` +
            `Please send the bypass result (text, photo, video, document, or animation):`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "admin_back" }]
                    ]
                }
            }
        );
    }

    // ==================== SUPPORTING/DONATION SYSTEM METHODS ====================

    async showSupportingOptions(chatId) {
        const text = `${this.getText(chatId, 'supporting_title')}\n\n${this.getText(chatId, 'supporting_message')}`;

        const buttons = [
            [
                { text: this.getText(chatId, 'supporting_payment'), callback_data: "supporting_payment", icon_custom_emoji_id: "6334406738111897018", style: "success" },
                { text: this.getText(chatId, 'supporting_qr'), callback_data: "supporting_qr", icon_custom_emoji_id: "6334406738111897018", style: "danger" }
            ],
            [
                { text: this.getText(chatId, 'supporting_back'), callback_data: "back_menu", icon_custom_emoji_id: "5258084656674250503", style: "success" }
            ]
        ];

        const sentMessage = await this.bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: buttons }
        });
        this.messageTypes[sentMessage.message_id] = 'text';
    }

    async showPaymentMethods(chatId) {
        const text = `${this.getText(chatId, 'payment_methods')}\n\n` +
                     `${this.getText(chatId, 'payment_wave')}\n` +
                     `${this.getText(chatId, 'payment_name')}\n\n` +
                     `${this.getText(chatId, 'payment_instruction')}`;

        const buttons = [
            [
                {
                    text: this.getText(chatId, 'supporting_copy_number'),
                    copy_text: {
                        text: "09788163900"
                    },
                    icon_custom_emoji_id: "6334406738111897018",
                    style: "success"
                }
            ],
            [
                { text: this.getText(chatId, 'supporting_send_screenshot'), callback_data: "supporting_send_screenshot", icon_custom_emoji_id: "6334406738111897018", style: "success" }
            ],
            [
                { text: this.getText(chatId, 'supporting_back'), callback_data: "user_supporting", icon_custom_emoji_id: "5258084656674250503", style: "success" }
            ]
        ];

        const sentMessage = await this.bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: buttons }
        });
        this.messageTypes[sentMessage.message_id] = 'text';
    }

    async showQRPayment(chatId) {
        try {
            // Send new message with QR
            const sentMessage = await this.bot.sendPhoto(chatId, this.qrImageUrl, {
                caption: `${this.getText(chatId, 'qr_payment_title')}\n\n` +
                         `${this.getText(chatId, 'payment_methods')}\n` +
                         `${this.getText(chatId, 'payment_wave')}\n` +
                         `${this.getText(chatId, 'payment_name')}\n\n` +
                         `${this.getText(chatId, 'payment_instruction')}`,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: this.getText(chatId, 'supporting_copy_number'),
                                copy_text: {
                                    text: "09788163900"
                                },
                                icon_custom_emoji_id: "6334406738111897018",
                                style: "danger"
                            }
                        ],
                        [
                            { text: this.getText(chatId, 'supporting_send_screenshot'), callback_data: "supporting_send_screenshot", icon_custom_emoji_id: "6334406738111897018", style: "danger" }
                        ],
                        [
                            { text: this.getText(chatId, 'supporting_back'), callback_data: "user_supporting", icon_custom_emoji_id: "5258084656674250503", style: "success" }
                        ]
                    ]
                }
            });
            this.messageTypes[sentMessage.message_id] = 'photo';
        } catch (error) {
            console.error('Error sending QR payment:', error);
        }
    }

    async initScreenshotUpload(chatId, messageId) {
        this.paymentMode[chatId] = true;
        
        try {
            await this.bot.editMessageText(this.getText(chatId, 'send_screenshot_instruction'), {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: this.getText(chatId, 'button_cancel'), callback_data: "supporting_cancel", icon_custom_emoji_id: "5258084656674250503", style: "success" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async processPaymentScreenshot(chatId, userId, photoId, username, firstName) {
        // Generate unique ID for this payment
        const paymentId = this.generateDeepLinkId();
        
        // Send to all admins
        for (const adminId of this.adminIds) {
            try {
                const caption = `💰 New Payment Received!\n\n` +
                              `👤 User: ${firstName} (ID: ${userId})\n` +
                              `📛 Username: @${username}\n` +
                              `🕒 Time: ${this.formatMyanmarTime()}\n` +
                              `🆔 Payment ID: ${paymentId}`;
                
                const sentMessage = await this.bot.sendPhoto(adminId, photoId, {
                    caption: caption,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "👤 User Profile", url: `tg://user?id=${userId}` },
                                { text: "💬 Reply to User", callback_data: `admin_payment_reply_${userId}` }
                            ]
                        ]
                    }
                });
                this.messageTypes[sentMessage.message_id] = 'photo';
            } catch (error) {
                console.error(`Error sending to admin ${adminId}:`, error);
            }
        }
        
        // Send confirmation to user
        await this.bot.sendMessage(chatId, this.getText(chatId, 'payment_confirmation'), {
            parse_mode: 'HTML'
        });
        
        // Clean up
        delete this.paymentMode[chatId];
    }

    async initPaymentReply(chatId, messageId, userId) {
        this.feedbackWaitingForReply[chatId] = {
            userId: userId,
            type: 'payment_reply'
        };
        
        // Send new message
        const sentMessage = await this.bot.sendMessage(chatId, `💬 <b>Replying to Payment User</b>\n\nUser ID: <code>${userId}</code>\n\nPlease send your reply message:`, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel", callback_data: "admin_back", icon_custom_emoji_id: "5258084656674250503", style: "success" }]
                ]
            }
        });
        this.messageTypes[sentMessage.message_id] = 'text';
    }

    // ==================== BAN MANAGEMENT METHODS ====================

    async showBanManagement(chatId, messageId) {
        const text = `🚫 <b>User Ban Management</b>\n\n` +
                    `Total Banned Users: ${this.bannedUsers.length}\n\n` +
                    `Select an option:`;
        
        const buttons = [
            [
                { text: "🚫 Ban User", callback_data: "admin_ban_user" },
                { text: "✅ Unban User", callback_data: "admin_unban_user" }
            ],
            [
                { text: "📋 Ban List", callback_data: "admin_ban_list" }
            ],
            [
                { text: "⬅️ Back", callback_data: "admin_back" }
            ]
        ];
        
        try {
            await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: buttons }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error showing ban management:', error);
        }
    }

    async initBanUser(chatId, messageId) {
        this.adminState[chatId] = 'ban_user';
        
        try {
            await this.bot.editMessageText("🚫 <b>Ban User</b>\n\nSend the User ID to ban:", {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "admin_ban", icon_custom_emoji_id: "5258084656674250503", style: "success" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async initUnbanUser(chatId, messageId) {
        this.adminState[chatId] = 'unban_user';
        
        try {
            await this.bot.editMessageText("✅ <b>Unban User</b>\n\nSend the User ID to unban:", {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "admin_ban", icon_custom_emoji_id: "5258084656674250503", style: "success" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async showBanList(chatId, messageId) {
        if (this.bannedUsers.length === 0) {
            try {
                await this.bot.editMessageText("📭 <b>No banned users!</b>", {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "⬅️ Back", callback_data: "admin_ban", icon_custom_emoji_id: "5258084656674250503", style: "success" }]
                        ]
                    }
                });
                this.messageTypes[messageId] = 'text';
            } catch (error) {
                console.error('Error editing message:', error);
            }
            return;
        }
        
        let banListText = `🚫 <b>Banned Users List</b>\n\n`;
        banListText += `Total: ${this.bannedUsers.length} users\n\n`;
        
        this.bannedUsers.forEach((userId, index) => {
            banListText += `${index + 1}. User ID: <code>${userId}</code>\n`;
        });
        
        const buttons = [
            [
                { text: "🔄 Refresh", callback_data: "admin_ban_list" },
                { text: "⬅️ Back", callback_data: "admin_ban" }
            ]
        ];
        
        try {
            await this.bot.editMessageText(banListText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: buttons }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error showing ban list:', error);
        }
    }

    // Handle admin state messages (ban/unban)
    async handleAdminState(chatId, userId, text, msg) {
        if (this.adminState[chatId] === 'ban_user') {
            const targetUserId = text.trim();
            
            // Validate user ID
            if (!targetUserId.match(/^\d+$/)) {
                await this.bot.sendMessage(chatId, "❌ Invalid User ID. Please enter a numeric User ID.", {
                    parse_mode: 'HTML'
                });
                return;
            }
            
            // Prevent admin from banning themselves
            if (this.isAdmin(targetUserId)) {
                await this.bot.sendMessage(chatId, "❌ You cannot ban another admin!", {
                    parse_mode: 'HTML'
                });
                delete this.adminState[chatId];
                return;
            }
            
            if (this.banUser(targetUserId)) {
                await this.bot.sendMessage(chatId, `✅ User <code>${targetUserId}</code> has been banned.`, {
                    parse_mode: 'HTML'
                });
            } else {
                await this.bot.sendMessage(chatId, `⚠️ User <code>${targetUserId}</code> is already banned or is an admin.`, {
                    parse_mode: 'HTML'
                });
            }
            
            delete this.adminState[chatId];
            
        } else if (this.adminState[chatId] === 'unban_user') {
            const targetUserId = text.trim();
            
            // Validate user ID
            if (!targetUserId.match(/^\d+$/)) {
                await this.bot.sendMessage(chatId, "❌ Invalid User ID. Please enter a numeric User ID.", {
                    parse_mode: 'HTML'
                });
                return;
            }
            
            if (this.unbanUser(targetUserId)) {
                await this.bot.sendMessage(chatId, `✅ User <code>${targetUserId}</code> has been unbanned.`, {
                    parse_mode: 'HTML'
                });
            } else {
                await this.bot.sendMessage(chatId, `⚠️ User <code>${targetUserId}</code> is not banned.`, {
                    parse_mode: 'HTML'
                });
            }
            
            delete this.adminState[chatId];
        }
    }

    // ==================== USER MANAGEMENT METHODS ====================

    async showUserList(chatId, messageId, page = 0) {
        const usersPerPage = 10;
        const startIndex = page * usersPerPage;
        const endIndex = startIndex + usersPerPage;
        
        // Get current page of users
        const pageUsers = this.users.slice(startIndex, endIndex);
        
        let userText = `👥 <b>User Management</b>\n\n`;
        userText += `<b>Total Users:</b> ${this.users.length}\n`;
        userText += `<b>Banned Users:</b> ${this.bannedUsers.length}\n`;
        userText += `<b>Page:</b> ${page + 1}/${Math.ceil(this.users.length / usersPerPage)}\n\n`;
        
        for (let i = 0; i < pageUsers.length; i++) {
            const rawId = pageUsers[i];
            // Normalize: extract numeric ID whether stored as number or object
            const userId = typeof rawId === 'object' && rawId !== null
                ? (rawId.id || rawId.userId || JSON.stringify(rawId))
                : parseInt(rawId, 10) || rawId;
            const userNum = startIndex + i + 1;
            
            try {
                // Try to get user info
                const userInfo = await this.bot.getChat(userId);
                const username = userInfo.username ? `@${userInfo.username}` : 'No username';
                const firstName = userInfo.first_name || 'Unknown';
                
                userText += `${userNum}. <code>${userId}</code> - ${firstName} ${username}\n`;
            } catch (error) {
                // If we cannot fetch info, just show ID with "Unknown"
                userText += `${userNum}. <code>${userId}</code> - Unknown user\n`;
            }
        }
        
        const buttons = [];
        
        // Navigation buttons
        const navButtons = [];
        if (page > 0) {
            navButtons.push({ text: "⬅️ Previous", callback_data: `admin_users_page_${page - 1}` });
        }
        if (endIndex < this.users.length) {
            navButtons.push({ text: "Next ➡️", callback_data: `admin_users_page_${page + 1}` });
        }
        if (navButtons.length > 0) {
            buttons.push(navButtons);
        }
        
        buttons.push([
            { text: "🚫 Ban Management", callback_data: "admin_ban" },
            { text: "🔄 Refresh", callback_data: `admin_users_page_${page}` }
        ]);
        
        buttons.push([
            { text: "⬅️ Back", callback_data: "admin_back" }
        ]);
        
        try {
            await this.bot.editMessageText(userText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: buttons }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error showing user list:', error);
        }
    }

    // ==================== FEEDBACK SYSTEM METHODS ====================

    async initFeedbackReply(chatId, messageId, feedbackId) {
        const feedback = this.adminFeedbacks[feedbackId];
        
        if (!feedback) {
            try {
                const sentMessage = await this.bot.sendMessage(chatId, "❌ Feedback not found!");
                this.messageTypes[sentMessage.message_id] = 'text';
            } catch (error) {
                console.error('Error sending message:', error);
            }
            return;
        }
        
        this.feedbackWaitingForReply[chatId] = {
            feedbackId: feedbackId,
            type: 'feedback_reply'
        };
        
        let userInfo = `💬 <b>Replying to Feedback</b>\n\n`;
        userInfo += `👤 <b>User:</b> ${feedback.firstName} (ID: ${feedback.userId})\n`;
        userInfo += `📝 <b>Original Feedback:</b>\n`;
        
        if (feedback.type === 'text') {
            userInfo += feedback.content.substring(0, 200);
            if (feedback.content.length > 200) userInfo += '...';
        } else {
            userInfo += `[${feedback.type.toUpperCase()}] `;
            if (feedback.caption) {
                userInfo += feedback.caption.substring(0, 200);
                if (feedback.caption.length > 200) userInfo += '...';
            }
        }
        
        userInfo += `\n\n✍️ <b>Now send your reply to the user (text, photo, video, or document):</b>`;
        
        // Send new message
        const sentMessage = await this.bot.sendMessage(chatId, userInfo, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "❌ Cancel", callback_data: "admin_back", icon_custom_emoji_id: "5258084656674250503", style: "success" }]
                ]
            }
        });
        this.messageTypes[sentMessage.message_id] = 'text';
    }

    async initFeedback(chatId, messageId, user) {
        this.feedbackMode[chatId] = true;
        this.feedbackData[chatId] = {
            userId: user.id,
            username: user.username || 'N/A',
            firstName: user.first_name || 'User',
            type: 'text',
            content: '',
            media: null,
            waitingFor: 'content',
            messageId: null
        };
        
        // Delete the feedback menu message (if provided)
        if (messageId) {
            try { await this.bot.deleteMessage(chatId, messageId); } catch {}
        }
        
        const sentMessage = await this.bot.sendMessage(chatId, `${this.getText(chatId, 'feedback_instruction')}`, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: this.getText(chatId, 'button_cancel'), callback_data: "feedback_cancel", icon_custom_emoji_id: "5258084656674250503", style: "success" }]
                ]
            }
        });
        this.messageTypes[sentMessage.message_id] = 'text';
    }

    async sendFeedbackToAdmins(chatId, feedbackData) {
        // Generate unique feedback ID
        const feedbackId = this.generateDeepLinkId();
        
        // Store feedback
        this.adminFeedbacks[feedbackId] = {
            id: feedbackId,
            ...feedbackData,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };
        
        // Prepare user info
        let userInfo = `👤 <b>User Info:</b>\n`;
        userInfo += `• ID: <code>${feedbackData.userId}</code>\n`;
        userInfo += `• Username: @${feedbackData.username}\n`;
        userInfo += `• Name: ${feedbackData.firstName}\n`;
        userInfo += `• Time: ${this.formatMyanmarTime()}\n\n`;
        
        // Create buttons for admins
        const buttons = [
            [
                { 
                    text: "💬 Reply to User", 
                    callback_data: `feedback_reply_${feedbackId}` 
                },
                { 
                    text: "👁️ View Details", 
                    callback_data: `feedback_view_${feedbackId}` 
                }
            ],
            [
                { 
                    text: "📱 User Profile", 
                    url: `tg://user?id=${feedbackData.userId}` 
                }
            ]
        ];
        
        // Send to all admins
        for (const adminId of this.adminIds) {
            try {
                if (feedbackData.type === 'text') {
                    const sentMessage = await this.bot.sendMessage(adminId, `📨 <b>New Feedback Received</b>\n\n${userInfo}<b>Message:</b>\n${feedbackData.content}`, {
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: buttons }
                    });
                    this.messageTypes[sentMessage.message_id] = 'text';
                } else if (feedbackData.type === 'photo' && feedbackData.media) {
                    // Photo အတွက် caption ကိုတိုတောင်းအောင် လုပ်မယ်
                    const caption = `📨 <b>New Feedback Received</b>\n\n${userInfo}<b>Caption:</b>\n${feedbackData.caption || 'No caption'}`;
                    const shortCaption = caption.length > 1024 ? caption.substring(0, 1020) + '...' : caption;
                    
                    const sentMessage = await this.bot.sendPhoto(adminId, feedbackData.media, {
                        caption: shortCaption,
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: buttons }
                    });
                    this.messageTypes[sentMessage.message_id] = 'photo';
                } else if (feedbackData.type === 'video' && feedbackData.media) {
                    const caption = `📨 <b>New Feedback Received</b>\n\n${userInfo}<b>Caption:</b>\n${feedbackData.caption || 'No caption'}`;
                    const shortCaption = caption.length > 1024 ? caption.substring(0, 1020) + '...' : caption;
                    
                    const sentMessage = await this.bot.sendVideo(adminId, feedbackData.media, {
                        caption: shortCaption,
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: buttons }
                    });
                    this.messageTypes[sentMessage.message_id] = 'video';
                } else if (feedbackData.type === 'document' && feedbackData.media) {
                    const caption = `📨 <b>New Feedback Received</b>\n\n${userInfo}<b>Caption:</b>\n${feedbackData.caption || 'No caption'}`;
                    const shortCaption = caption.length > 1024 ? caption.substring(0, 1020) + '...' : caption;
                    
                    const sentMessage = await this.bot.sendDocument(adminId, feedbackData.media, {
                        caption: shortCaption,
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: buttons }
                    });
                    this.messageTypes[sentMessage.message_id] = 'document';
                } else if (feedbackData.type === 'gif' && feedbackData.media) {
                    const caption = `📨 <b>New Feedback Received</b>\n\n${userInfo}<b>Caption:</b>\n${feedbackData.caption || 'No caption'}`;
                    const shortCaption = caption.length > 1024 ? caption.substring(0, 1020) + '...' : caption;
                    
                    const sentMessage = await this.bot.sendAnimation(adminId, feedbackData.media, {
                        caption: shortCaption,
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: buttons }
                    });
                    this.messageTypes[sentMessage.message_id] = 'gif';
                }
            } catch (error) {
                console.error(`Error sending feedback to admin ${adminId}:`, error);
            }
        }
        
        // User ကိုပြမယ့် confirmation message ကို ပို့မယ်
        const userConfirmMsg = await this.bot.sendMessage(chatId, this.getText(chatId, 'feedback_thankyou'), {
            parse_mode: 'HTML'
        });
        
        // User feedback message ကို auto delete လုပ်မယ် (5 စက္ကန့်)
        setTimeout(async () => {
            try {
                await this.bot.deleteMessage(chatId, userConfirmMsg.message_id);
            } catch (e) {
                console.error('Error deleting feedback confirmation:', e.message);
            }
        }, 5000);
        
        // Clean up
        delete this.feedbackMode[chatId];
        delete this.feedbackData[chatId];
    }

    async viewFeedbackDetails(chatId, messageId, feedbackId) {
        const feedback = this.adminFeedbacks[feedbackId];
        
        if (!feedback) {
            try {
                const sentMessage = await this.bot.sendMessage(chatId, "❌ Feedback not found!");
                this.messageTypes[sentMessage.message_id] = 'text';
            } catch (error) {
                console.error('Error sending message:', error);
            }
            return;
        }
        
        let details = `📋 <b>Feedback Details</b>\n\n`;
        details += `🆔 <b>ID:</b> <code>${feedback.id}</code>\n`;
        details += `👤 <b>User ID:</b> <code>${feedback.userId}</code>\n`;
        details += `📛 <b>Username:</b> @${feedback.username}\n`;
        details += `👨‍💼 <b>Name:</b> ${feedback.firstName}\n`;
        details += `📅 <b>Time:</b> ${this.formatMyanmarTime(feedback.timestamp)}\n`;
        details += `📝 <b>Type:</b> ${feedback.type}\n`;
        details += `📊 <b>Status:</b> ${feedback.status}\n\n`;
        
        if (feedback.type === 'text') {
            details += `<b>Message:</b>\n${feedback.content}\n`;
        } else {
            details += `<b>Caption:</b>\n${feedback.caption || 'No caption'}\n`;
        }
        
        const buttons = [
            [
                { text: "💬 Reply", callback_data: `feedback_reply_${feedbackId}` },
                { text: "📱 Profile", url: `tg://user?id=${feedback.userId}` }
            ],
            [
                { text: "⬅️ Back", callback_data: "admin_back" }
            ]
        ];
        
        // Send new message
        const sentMessage = await this.bot.sendMessage(chatId, details, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: buttons }
        });
        this.messageTypes[sentMessage.message_id] = 'text';
    }

    // ==================== AUTO-DELETE BYPASS LINKS ====================

    scheduleAutoDelete(chatId, messageIds, isSuccess = true) {
        const delay = isSuccess ? this.autoDeleteDelay : this.failedAutoDeleteDelay;
        
        setTimeout(async () => {
            for (const messageId of messageIds) {
                try {
                    await this.bot.deleteMessage(chatId, messageId);
                    console.log(`✅ Auto-deleted message ${messageId} in chat ${chatId}`);
                } catch (error) {
                    // Message might already be deleted or not found
                    if (!error.message.includes('message to delete not found')) {
                        console.error(`Error auto-deleting message ${messageId}:`, error.message);
                    }
                }
            }
        }, delay);
    }

    // ==================== DEEP LINK METHODS ====================

    async initDeepLinkCreation(chatId, messageId) {
        this.deepLinkMode[chatId] = true;
        this.deepLinkData[chatId] = {
            type: 'text',
            content: '',
            buttons: [],
            media: null,
            caption: '',
            waitingFor: null,
            showCopyButton: false,
            copyText: '',
            pollOptions: []
        };
        
        try {
            await this.bot.editMessageText(`🔗 <b>Create Deep Link Post</b>\n\nSelect content type for your deep link:`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "📝 Text", callback_data: "deeplink_text" },
                            { text: "🖼️ Photo", callback_data: "deeplink_photo" }
                        ],
                        [
                            { text: "🎬 Video", callback_data: "deeplink_video" },
                            { text: "📁 File", callback_data: "deeplink_document" }
                        ],
                        [
                            { text: "🎞️ GIF", callback_data: "deeplink_gif" },
                            { text: "📊 Poll", callback_data: "deeplink_poll" }
                        ],
                        [
                            { text: "❌ Cancel", callback_data: "admin_back" }
                        ]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async setDeepLinkType(chatId, type, messageId) {
        this.deepLinkData[chatId].type = type;
        
        let message = "";
        if (type === 'text') {
            message = "📝 <b>Text Deep Link Selected</b>\n\nPlease send the text content (HTML formatting supported):";
            this.deepLinkData[chatId].waitingFor = 'content';
        } else if (type === 'photo') {
            message = "🖼️ <b>Photo Deep Link Selected</b>\n\nPlease send the photo:";
        } else if (type === 'video') {
            message = "🎬 <b>Video Deep Link Selected</b>\n\nPlease send the video:";
        } else if (type === 'document') {
            message = "📁 <b>File Deep Link Selected</b>\n\nPlease send the file:";
        } else if (type === 'gif') {
            message = "🎞️ <b>GIF Deep Link Selected</b>\n\nPlease send the GIF:";
        } else if (type === 'poll') {
            message = "📊 <b>Poll Deep Link Selected</b>\n\nPlease send the poll question:";
            this.deepLinkData[chatId].waitingFor = 'content';
        }
        
        try {
            await this.bot.editMessageText(message, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "deeplink_cancel" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async addDeepLinkButtons(chatId, messageId) {
        // Start interactive wizard instead of showing text guide
        await this.startDeepLinkButtonWizard(chatId, messageId);
    }

    async editDeepLinkText(chatId, messageId) {
        const data = this.deepLinkData[chatId];
        data.waitingFor = 'content';
        
        try {
            await this.bot.editMessageText("📝 <b>Edit Text</b>\n\nPlease send the new text for your deep link (HTML formatting supported):", {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "deeplink_cancel" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async editDeepLinkCaption(chatId, messageId) {
        const data = this.deepLinkData[chatId];
        data.waitingFor = 'caption';
        
        try {
            await this.bot.editMessageText("📝 <b>Edit Caption</b>\n\nPlease send the new caption for your deep link (HTML formatting supported):", {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "deeplink_cancel" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async addDeepLinkCopyButton(chatId, messageId) {
        const data = this.deepLinkData[chatId];
        data.waitingFor = 'copy_text';
        
        try {
            await this.bot.editMessageText("📋 <b>Add Copy Button</b>\n\nEnter the text you want users to be able to copy:", {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "deeplink_cancel" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async previewDeepLink(chatId, messageId) {
        const data = this.deepLinkData[chatId];
        
        if (!data.content && !data.media && data.type !== 'poll') {
            try {
                await this.bot.editMessageText("⚠️ No content to preview!", {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "❌ Cancel", callback_data: "deeplink_cancel" }]
                        ]
                    }
                });
                this.messageTypes[messageId] = 'text';
            } catch (error) {
                console.error('Error editing message:', error);
            }
            return;
        }
        
        const replyMarkup = this.buildSafeReplyMarkup(data.buttons);
        
        try {
            if (data.type === 'text') {
                await this.bot.sendMessage(chatId, `<b>📝 Preview of Your Deep Link:</b>\n\n${data.content}`, {
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            } 
            else if (data.type === 'photo' && data.media) {
                await this.bot.sendPhoto(chatId, data.media, {
                    caption: data.caption ? `<b>🖼️ Preview:</b>\n\n${data.caption}` : undefined,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            else if (data.type === 'video' && data.media) {
                await this.bot.sendVideo(chatId, data.media, {
                    caption: data.caption ? `<b>🎬 Preview:</b>\n\n${data.caption}` : undefined,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            else if (data.type === 'document' && data.media) {
                await this.bot.sendDocument(chatId, data.media, {
                    caption: data.caption ? `<b>📁 Preview:</b>\n\n${data.caption}` : undefined,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            else if (data.type === 'gif' && data.media) {
                await this.bot.sendAnimation(chatId, data.media, {
                    caption: data.caption ? `<b>🎞️ Preview:</b>\n\n${data.caption}` : undefined,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            else if (data.type === 'poll') {
                let previewText = `<b>📊 Poll Preview:</b>\n\n<b>Question:</b> ${data.content}\n\n<b>Options:</b>\n`;
                data.pollOptions.forEach((opt, idx) => {
                    previewText += `${idx + 1}. ${opt}\n`;
                });
                
                await this.bot.sendMessage(chatId, previewText, {
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            
            await this.bot.sendMessage(chatId, "👆 This is how your deep link will look to users.", {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "🚀 Generate Deep Link", callback_data: "deeplink_generate" },
                            { text: "📋 Add Copy Button", callback_data: "deeplink_add_copy" }
                        ],
                        [
                            { text: "📝 Edit Text", callback_data: "deeplink_edit_text" },
                            { text: "👁️ Preview Again", callback_data: "deeplink_preview" }
                        ],
                        [
                            { text: "❌ Cancel", callback_data: "deeplink_cancel" }
                        ]
                    ]
                }
            });
        } catch (error) {
            console.error('Preview error:', error);
            await this.bot.sendMessage(chatId, "❌ Error creating preview.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "deeplink_cancel" }]
                    ]
                }
            });
        }
    }

    async generateDeepLink(chatId, messageId) {
        const data = this.deepLinkData[chatId];
        
        if (!data.content && !data.media && data.type !== 'poll') {
            try {
                await this.bot.editMessageText("⚠️ No content to generate link!", {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "❌ Cancel", callback_data: "deeplink_cancel" }]
                        ]
                    }
                });
                this.messageTypes[messageId] = 'text';
            } catch (error) {
                console.error('Error editing message:', error);
            }
            return;
        }
        
        // Create deep link entry
        const deepLinkId = this.generateDeepLinkId();
        const deepLinkEntry = {
            id: deepLinkId,
            type: data.type,
            content: data.content,
            media: data.media,
            caption: data.caption,
            buttons: data.buttons,
            pollOptions: data.pollOptions,
            showCopyButton: data.showCopyButton,
            copyText: data.copyText,
            createdAt: new Date().toISOString(),
            createdBy: chatId,
            usageCount: 0
        };
        
        // Add to deep links
        this.deepLinks.push(deepLinkEntry);
        this.saveDeepLinks();
        
        // Add to history
        this.addHistoryEntry('deeplink', {
            id: deepLinkId,
            type: data.type,
            preview: data.type === 'text' ? data.content.substring(0, 100) + (data.content.length > 100 ? '...' : '') : `${data.type.charAt(0).toUpperCase() + data.type.slice(1)} Content`,
            timestamp: new Date().toISOString()
        });
        
        // Generate deep link URL
        const botUsername = '@RKE_blox_bypass_bot';
        const deepLinkUrl = `https://t.me/RKE_blox_bypass_bot?start=${deepLinkId}`;
        
        let successMsg = `✅ <b>Deep Link Created Successfully!</b>\n\n`;
        successMsg += `<b>Deep Link ID:</b> <code>${deepLinkId}</code>\n`;
        successMsg += `<b>Type:</b> ${data.type.charAt(0).toUpperCase() + data.type.slice(1)}\n`;
        successMsg += `<b>Created:</b> ${this.formatMyanmarTime()}\n`;
        successMsg += `<b>Copy Button:</b> ${data.showCopyButton ? '✅ Enabled' : '❌ Disabled'}\n\n`;
        
        successMsg += `<b>🔗 Share this link:</b>\n`;
        successMsg += `<code>${deepLinkUrl}</code>\n\n`;
        
        successMsg += `<b>📱 Users will see:</b>\n`;
        
        if (data.type === 'text') {
            successMsg += `• Text message: "${data.content.substring(0, 50)}${data.content.length > 50 ? '...' : ''}"\n`;
        } else if (['photo', 'video', 'document', 'gif'].includes(data.type)) {
            successMsg += `• ${data.type.charAt(0).toUpperCase() + data.type.slice(1)}\n`;
            if (data.caption) {
                successMsg += `• Caption: "${data.caption.substring(0, 50)}${data.caption.length > 50 ? '...' : ''}"\n`;
            }
        } else if (data.type === 'poll') {
            successMsg += `• Poll with ${data.pollOptions?.length || 0} options\n`;
        }
        
        if (data.buttons.length > 0) {
            successMsg += `\n<b>Buttons:</b>\n`;
            data.buttons.forEach((row, rowIndex) => {
                successMsg += `Row ${rowIndex + 1}: `;
                row.forEach((btn, btnIndex) => {
                    let label = btn.text;
                    if (btn.url) label += ` (${btn.url})`;
                    else if (btn.callback_data) label += ` (callback: ${btn.callback_data})`;
                    else if (btn.copy_text) label += ` (copy)`;
                    successMsg += `[${label}]`;
                    if (btnIndex < row.length - 1) successMsg += ' ↔ ';
                });
                successMsg += '\n';
            });
        }
        
        if (data.showCopyButton && data.copyText) {
            successMsg += `\n• Copy button: "${data.copyText.substring(0, 30)}${data.copyText.length > 30 ? '...' : ''}"\n`;
        }
        
        successMsg += `\n<b>📊 Usage:</b> Will be tracked in history`;
        
        try {
            await this.bot.editMessageText(successMsg, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "Copy Link",
                                copy_text: {
                                    text: deepLinkUrl
                                }
                            },
                            { text: "🔗 Open Link", url: deepLinkUrl }
                        ],
                        [
                            { text: "📊 View History", callback_data: "admin_history" },
                            { text: "➕ Create Another", callback_data: "admin_deeplink" }
                        ],
                        [
                            { text: "⬅️ Back to Admin", callback_data: "admin_back" }
                        ]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
        
        // Clean up
        delete this.deepLinkMode[chatId];
        delete this.deepLinkData[chatId];
    }

    async cancelDeepLink(chatId, messageId) {
        delete this.deepLinkMode[chatId];
        delete this.deepLinkData[chatId];
        delete this.deepLinkButtonWizard[chatId];
        
        try {
            await this.bot.deleteMessage(chatId, messageId);
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    }

    async handleDeepLinkStart(chatId, userId, deepLinkId, replyToMessageId = null) {
        // Check if user is banned
        if (this.isBanned(userId.toString())) {
            await this.bot.sendMessage(chatId, "❌ You have been banned from using this bot.");
            return;
        }
        
        // ---- ENFORCE JOIN CHECK FOR GROUPS ----
        const chat = await this.bot.getChat(chatId);
        if (chat.type !== 'private') {
            const missingChannels = await this.checkUserJoinStatus(chatId, userId);
            if (missingChannels.length > 0) {
                // Store pending deep link and show join message, replying to original message if provided
                this.pendingDeepLinks[userId] = deepLinkId;
                await this.showJoinRequiredMessage(chatId, missingChannels, null, replyToMessageId);
                return;
            }
        }
        // ---- END JOIN ENFORCEMENT ----
        
        const entry = this.deepLinks.find(dl => dl.id === deepLinkId);
        if (!entry) {
            await this.bot.sendMessage(chatId, "❌ Invalid or expired deep link!", {
                reply_to_message_id: replyToMessageId
            });
            return;
        }
        
        // Update usage count
        entry.usageCount = (entry.usageCount || 0) + 1;
        this.saveDeepLinks();
        this.updateHistoryUsage(deepLinkId);
        
        // Prepare buttons
        let buttons = entry.buttons || [];
        
        // Add copy button for text content
        if (entry.type === 'text' && entry.content) {
            const isScript = entry.content.includes('loadstring') || 
                            entry.content.includes('game:HttpGet') ||
                            entry.content.includes('getgenv');
            if (isScript) {
                const copyButton = {
                    text: "Copy Script",
                    copy_text: { text: entry.content }
                };
                if (buttons.length === 0) buttons = [[copyButton]];
                else {
                    const hasCopyButton = buttons.some(row => row.some(btn => btn.copy_text));
                    if (!hasCopyButton) buttons.push([copyButton]);
                }
            }
        }
        
        if (entry.showCopyButton && entry.copyText) {
            const copyButton = {
                text: "Copy Script",
                copy_text: { text: entry.copyText }
            };
            if (buttons.length === 0) buttons = [[copyButton]];
            else buttons.push([copyButton]);
        }
        
        const replyMarkup = buttons.length > 0 ? { inline_keyboard: buttons } : undefined;
        
        try {
            if (entry.type === 'text') {
                let formattedContent = entry.content;
                if (entry.content.includes('loadstring') || 
                    entry.content.includes('game:HttpGet') ||
                    entry.content.includes('getgenv')) {
                    formattedContent = `\`\`\`lua\n${entry.content}\n\`\`\``;
                }
                await this.bot.sendMessage(chatId, formattedContent, {
                    parse_mode: 'Markdown',
                    reply_markup: replyMarkup,
                    reply_to_message_id: replyToMessageId
                });
            } 
            else if (entry.type === 'photo' && entry.media) {
                await this.bot.sendPhoto(chatId, entry.media, {
                    caption: entry.caption,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup,
                    reply_to_message_id: replyToMessageId
                });
            }
            else if (entry.type === 'video' && entry.media) {
                await this.bot.sendVideo(chatId, entry.media, {
                    caption: entry.caption,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup,
                    reply_to_message_id: replyToMessageId
                });
            }
            else if (entry.type === 'document' && entry.media) {
                await this.bot.sendDocument(chatId, entry.media, {
                    caption: entry.caption,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup,
                    reply_to_message_id: replyToMessageId
                });
            }
            else if (entry.type === 'gif' && entry.media) {
                await this.bot.sendAnimation(chatId, entry.media, {
                    caption: entry.caption,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup,
                    reply_to_message_id: replyToMessageId
                });
            }
            else if (entry.type === 'poll' && entry.pollOptions) {
                await this.bot.sendPoll(chatId, entry.content, entry.pollOptions, {
                    is_anonymous: false,
                    allows_multiple_answers: false,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup,
                    reply_to_message_id: replyToMessageId
                });
            }
        } catch (error) {
            console.error('Error sending deep link content:', error);
            await this.bot.sendMessage(chatId, "❌ Error loading content. The deep link may be corrupted.", {
                reply_to_message_id: replyToMessageId
            });
        }
    }

    // ==================== HISTORY METHODS ====================

    async showHistory(chatId, messageId) {
        if (this.history.length === 0) {
            try {
                await this.bot.editMessageText("📭 <b>No history yet!</b>\n\nCreate your first deep link to see history here.", {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "🔗 Create Deep Link", callback_data: "admin_deeplink" },
                                { text: "⬅️ Back", callback_data: "admin_back" }
                            ]
                        ]
                    }
                });
                this.messageTypes[messageId] = 'text';
            } catch (error) {
                console.error('Error editing message:', error);
            }
            return;
        }
        
        let historyText = `📊 <b>Deep Link History</b>\n\n`;
        historyText += `Total entries: ${this.history.length}\n\n`;
        
        // Show last 10 entries
        const recentHistory = this.history.slice(-10).reverse();
        const botUsername = '@RKE_blox_bypass_bot';
        
        for (const [index, entry] of recentHistory.entries()) {
            const myanmarDate = this.formatMyanmarTime(entry.timestamp);
            
            historyText += `<b>${index + 1}.</b> ${entry.type.toUpperCase()}\n`;
            historyText += `📅 ${myanmarDate}\n`;
            
            if (entry.data.preview) {
                historyText += `📝 ${entry.data.preview}\n`;
            }
            
            historyText += `🆔 <code>${entry.data.id}</code>\n`;
            historyText += `📊 Used: ${entry.usageCount || 0} times`;
            
            if (entry.lastUsed) {
                const lastUsedDate = this.formatMyanmarTime(entry.lastUsed);
                historyText += ` | ⏰ Last: ${lastUsedDate}`;
            }
            historyText += '\n\n';
        }
        
        const buttons = [];
        
        // Add link buttons for each entry (2 per row)
        for (let i = 0; i < recentHistory.length; i += 2) {
            const row = [];
            const entry1 = recentHistory[i];
            const link1 = `https://t.me/${botUsername}?start=${entry1.data.id}`;
            row.push({ text: `🔗 Link ${i + 1}`, url: link1 });
            
            if (i + 1 < recentHistory.length) {
                const entry2 = recentHistory[i + 1];
                const link2 = `https://t.me/${botUsername}?start=${entry2.data.id}`;
                row.push({ text: `🔗 Link ${i + 2}`, url: link2 });
            }
            buttons.push(row);
        }
        
        // Add control buttons
        buttons.push([
            { text: "🔄 Refresh", callback_data: "admin_history" },
            { text: "🗑️ Clear History", callback_data: "admin_clear_history" }
        ]);
        buttons.push([
            { text: "🔗 Create New", callback_data: "admin_deeplink" },
            { text: "⬅️ Back", callback_data: "admin_back" }
        ]);
        
        try {
            await this.bot.editMessageText(historyText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                reply_markup: { inline_keyboard: buttons }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async clearHistory(chatId, messageId) {
        this.history = [];
        this.saveHistory();
        
        try {
            await this.bot.editMessageText("🗑️ <b>History cleared successfully!</b>", {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "🔗 Create Deep Link", callback_data: "admin_deeplink" },
                            { text: "⬅️ Back", callback_data: "admin_back" }
                        ]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    // ==================== ADMIN PANEL METHODS ====================

    async showAdminPanel(chatId, userId, messageId = null) {
        if (!this.isAdmin(userId)) {
            await this.bot.sendMessage(chatId, "❌ Unauthorized access!");
            return;
        }
        
        const stats = await this.getAdminStats();
        const channelStatus = this.channelId ? 
            `✅ <code>${this.channelId}</code>` : 
            "❌ Not set";
        
        const menuText = `👑 <b>Admin Guide Panel</b>\n\n` +
            `<b>📊 Statistics:</b>\n` +
            `• Total Users: ${stats.totalUsers}\n` +
            `• Banned Users: ${this.bannedUsers.length}\n` +
            `• Active Today: ${stats.activeToday}\n` +
            `• Supported Domains: ${stats.supportedDomains}\n` +
            `• Deep Links: ${this.deepLinks.length}\n` +
            `• History Entries: ${this.history.length}\n\n` +
            `<b>📢 Channel Status:</b>\n${channelStatus}\n\n` +
            `<b>⚙️ Admin Tools:</b>\n` +
            `Select an option below:`;
        
        const buttons = [];
        
        // First row: Channel Management
        buttons.push([
            { text: "📢 Set Channel", callback_data: "admin_set_channel" },
            { text: "ℹ️ Channel Info", callback_data: "admin_channel_info" }
        ]);
        
        // Second row: Content Creation (always show Create Post, but may lead to channel selection)
        buttons.push([
            { text: "📝 Create Post", callback_data: "admin_create_post" },
            { text: "📨 Broadcast", callback_data: "admin_broadcast" }
        ]);
        
        // Third row: Deep Links & History
        buttons.push([
            { text: "🔗 Deep Links", callback_data: "admin_deeplink" },
            { text: "📋 History", callback_data: "admin_history" }
        ]);
        
        // Fourth row: Stats & Users
        buttons.push([
            { text: "📊 Statistics", callback_data: "admin_stats" },
            { text: "👥 Users", callback_data: "admin_users" }
        ]);
        buttons.push([
            { text: "🔍 Search User", callback_data: "admin_user_search", icon_custom_emoji_id: "5339141594471742013", style: "primary" },
            { text: "📊 Broadcast Stats", callback_data: "broadcast_last_stats", icon_custom_emoji_id: "5350618807943576963", style: "success" }
        ]);
        
        // Fifth row: Ban Management
        buttons.push([
            { text: "🚫 Ban Users", callback_data: "admin_ban" }
        ]);

        // Sixth row: Script Bypass toggle
        const bypassStatus = this.scriptBypassEnabled ? '🟢 Script Bypass ON' : '🔴 Script Bypass OFF';
        buttons.push([
            { 
                text: bypassStatus,
                callback_data: "admin_toggle_bypass",
                icon_custom_emoji_id: this.scriptBypassEnabled ? "5368324170671202286" : "6269316311172518259",
                style: this.scriptBypassEnabled ? "success" : "danger"
            }
        ]);
        
        // Seventh row: Back
        buttons.push([
            { text: "Back to Main", callback_data: "back_menu", icon_custom_emoji_id: "5258084656674250503", style: "success" }
        ]);
        
        // If messageId given → edit existing message, else send new
        if (messageId) {
            try {
                await this.bot.editMessageText(menuText, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: buttons }
                });
                this.messageTypes[messageId] = 'text';
                return;
            } catch {}
        }
        const sentMessage = await this.bot.sendMessage(chatId, menuText, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: buttons }
        });
        this.messageTypes[sentMessage.message_id] = 'text';
    }

    // Alias for editing admin panel in place
    async showAdminPanelEdit(chatId, userId, messageId) {
        await this.showAdminPanel(chatId, userId, messageId);
    }

    // Example of using Reply Keyboard with Bot API 9.4 features
    async showReplyKeyboardExample(chatId) {
        // This is just an example - you can adapt this to any menu in your bot
        const keyboardRows = [
            [
                this.parseAdvancedKeyboardButton("မင်္ဂလာပါ | emoji:5363289431703514509 | style:primary"),
                this.parseAdvancedKeyboardButton("ကျေးဇူးတင်ပါတယ် | emoji:5363289431703514509 | style:secondary")
            ],
            [
                this.parseAdvancedKeyboardButton("အင်္ဂလိပ်စာ | emoji:5363289431703514509"),
                this.parseAdvancedKeyboardButton("မြန်မာစာ | style:primary")
            ]
        ];

        // Filter out any null buttons (parsing failed)
        const validKeyboardRows = keyboardRows
            .map(row => row.filter(btn => btn !== null))
            .filter(row => row.length > 0);

        if (validKeyboardRows.length > 0) {
            await this.bot.sendMessage(chatId, "အောက်က ခလုတ်တွေကို နှိပ်ပါ:", {
                reply_markup: {
                    keyboard: validKeyboardRows,
                    resize_keyboard: true,
                    one_time_keyboard: true
                }
            });
        }
    }

    async initSetChannel(chatId, messageId) {
        this.setChannelMode[chatId] = true;
        
        const guideText = `📢 <b>Set Channel for Posting</b>\n\n` +
            `<b>Step 1:</b> Add bot to your channel as ADMIN\n` +
            `<b>Step 2:</b> Give bot "Post Messages" permission\n` +
            `<b>Step 3:</b> Send channel ID below:\n\n` +
            `<b>Format:</b>\n` +
            `• @channel_username\n` +
            `• -1001234567890 (Channel ID)\n\n` +
            `<b>To get Channel ID:</b>\n` +
            `1. Forward a message from channel to @RawDataBot\n` +
            `2. Copy "forward_from_chat.id"\n\n` +
            `<b>Now send the Channel ID:</b>`;
        
        try {
            await this.bot.editMessageText(guideText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "admin_cancel", icon_custom_emoji_id: "5258084656674250503", style: "success" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async showChannelInfo(chatId, messageId) {
        if (!this.channelId) {
            try {
                await this.bot.editMessageText("❌ No channel set! Please set a channel first.", {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "📢 Set Channel", callback_data: "admin_set_channel" }],
                            [{ text: "⬅️ Back", callback_data: "admin_back" }]
                        ]
                    }
                });
                this.messageTypes[messageId] = 'text';
            } catch (error) {
                console.error('Error editing message:', error);
            }
            return;
        }
        
        const perms = await this.checkChannelPermissions(this.channelId);
        
        let infoText = `📢 <b>Channel Information</b>\n\n`;
        infoText += `<b>ID:</b> <code>${this.channelId}</code>\n`;
        
        if (perms.exists) {
            infoText += `<b>Title:</b> ${perms.chat.title}\n`;
            infoText += `<b>Type:</b> ${perms.chat.type}\n\n`;
            infoText += `<b>Bot Status:</b>\n`;
            infoText += `• Admin: ${perms.isAdmin ? '✅' : '❌'}\n`;
            infoText += `• Can Post: ${perms.canPost ? '✅' : '❌'}\n`;
            
            if (!perms.isAdmin || !perms.canPost) {
                infoText += `\n⚠️ <b>Required:</b>\n`;
                infoText += `• Add bot as admin\n`;
                infoText += `• Enable "Post Messages" permission`;
            } else {
                infoText += `\n✅ <b>Ready to post!</b>`;
            }
        } else {
            infoText += `\n❌ Channel not found!\n`;
            infoText += `• Make sure bot is in channel\n`;
            infoText += `• Check channel ID format`;
        }
        
        const buttons = [
            [{ text: "🔄 Refresh", callback_data: "admin_channel_info" }]
        ];
        
        if (perms.exists && perms.isAdmin && perms.canPost) {
            buttons[0].push({ text: "📝 Create Post", callback_data: "admin_create_post" });
        } else {
            buttons[0].push({ text: "🔧 Set Channel", callback_data: "admin_set_channel" });
        }
        
        buttons.push([{ text: "⬅️ Back", callback_data: "admin_back" }]);
        
        try {
            await this.bot.editMessageText(infoText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: buttons }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Channel info error:', error);
        }
    }

    async initPostCreation(chatId, messageId) {
        // Show channel selection menu
        let menuText = `📝 <b>Create Channel Post</b>\n\n`;
        menuText += `<b>Select a channel to post:</b>\n\n`;
        
        const buttons = [];
        
        // Add channel selection buttons
        for (const channel of this.postChannels) {
            buttons.push([{ text: `📢 ${channel.name}`, callback_data: `select_channel_${channel.id}` }]);
        }
        
        buttons.push([{ text: "⬅️ Back", callback_data: "admin_back" }]);
        
        try {
            await this.bot.editMessageText(menuText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: buttons }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }
    
    async selectChannelAndCreatePost(chatId, messageId, channelId) {
        this.selectedChannelForPost[chatId] = channelId;
        
        const perms = await this.checkChannelPermissions(channelId);
        if (!perms.exists || !perms.isAdmin || !perms.canPost) {
            let errorMsg = `❌ Cannot create post!\n\n`;
            errorMsg += `Channel: <code>${channelId}</code>\n\n`;
            errorMsg += `• Admin: ${perms.isAdmin ? '✅' : '❌'}\n`;
            errorMsg += `• Can Post: ${perms.canPost ? '✅' : '❌'}\n\n`;
            errorMsg += "Please fix permissions first.";
            
            try {
                await this.bot.editMessageText(errorMsg, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "⬅️ Back", callback_data: "admin_create_post" }]
                        ]
                    }
                });
                this.messageTypes[messageId] = 'text';
            } catch (error) {
                console.error('Error editing message:', error);
            }
            return;
        }
        
        this.postMode[chatId] = true;
        this.postData[chatId] = {
            type: 'text',
            content: '',
            buttons: [],
            media: null,
            caption: '',
            waitingFor: null,
            channelId: channelId,
            pollOptions: []
        };
        
        try {
            await this.bot.editMessageText(`📢 <b>Create Channel Post</b>\n\nChannel: <code>${channelId}</code>\n\nSelect post type:`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "📝 Text", callback_data: "post_text" },
                            { text: "🖼️ Photo", callback_data: "post_photo" }
                        ],
                        [
                            { text: "🎬 Video", callback_data: "post_video" },
                            { text: "📁 Document", callback_data: "post_document" }
                        ],
                        [
                            { text: "🎞️ GIF", callback_data: "post_gif" },
                            { text: "📊 Poll", callback_data: "post_poll" }
                        ],
                        [
                            { text: "❌ Cancel", callback_data: "admin_back" }
                        ]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async initBroadcast(chatId, messageId) {
        this.broadcastMode[chatId] = true;
        this.broadcastData[chatId] = {
            type: 'text',
            content: '',
            buttons: [],
            media: null,
            caption: '',
            waitingFor: null
        };
        
        const totalUsers = this.users.length;
        
        try {
            await this.bot.editMessageText(`📨 <b>Create Broadcast</b>\n\n<b>Recipients:</b> ${totalUsers} users\n\nSelect broadcast type:`, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "📝 Text", callback_data: "broadcast_text" },
                            { text: "🖼️ Photo", callback_data: "broadcast_photo" }
                        ],
                        [
                            { text: "🎬 Video", callback_data: "broadcast_video" },
                            { text: "📁 Document", callback_data: "broadcast_document" }
                        ],
                        [
                            { text: "🎞️ GIF", callback_data: "broadcast_gif" },
                            { text: "😀 Sticker", callback_data: "broadcast_sticker" }
                        ],
                        [
                            { text: "❌ Cancel", callback_data: "admin_back" }
                        ]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async showAdminStats(chatId, messageId) {
        const stats = await this.getAdminStats();
        
        const statsText = `📊 <b>Bot Statistics</b>\n\n` +
            `<b>Users:</b>\n` +
            `• Total: ${stats.totalUsers}\n` +
            `• Banned: ${this.bannedUsers.length}\n` +
            `• Active Today: ${stats.activeToday}\n` +
            `• Active This Week: ${stats.activeWeek}\n\n` +
            `<b>System:</b>\n` +
            `• Supported Domains: ${stats.supportedDomains}\n` +
            `• Uptime: ${stats.uptime}\n` +
            `• Memory Usage: ${stats.memoryUsage}\n` +
            `• Deep Links: ${this.deepLinks.length}\n` +
            `• History Entries: ${this.history.length}\n\n` +
            `<b>Channel:</b>\n` +
            `• Set: ${this.channelId ? '✅' : '❌'}\n` +
            `• Ready: ${stats.channelReady ? '✅' : '❌'}\n\n` +
            `<b>Last Update:</b> ${stats.lastUpdate}`;
        
        try {
            await this.bot.editMessageText(statsText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🔄 Refresh", callback_data: "admin_stats" }],
                        [{ text: "⬅️ Back", callback_data: "admin_back" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async showAdminHelp(chatId, messageId) {
        const helpText = `❓ <b>Admin Guide</b>\n\n` +
            `<b>📢 Set Channel:</b>\n` +
            `1. Add bot to channel as Admin\n` +
            `2. Enable "Post Messages" permission\n` +
            `3. Send channel ID (@username or -100ID)\n\n` +
            `<b>📝 Create Post:</b>\n` +
            `1. Select post type\n` +
            `2. Add content (text, photo, etc.)\n` +
            `3. Add buttons (optional)\n` +
            `4. Preview & Publish\n\n` +
            `<b>📨 Broadcast:</b>\n` +
            `1. Select broadcast type\n` +
            `2. Add content\n` +
            `3. Add buttons (optional)\n` +
            `4. Send to all users\n\n` +
            `<b>🔗 Deep Links:</b>\n` +
            `1. Select content type\n` +
            `2. Add content/media\n` +
            `3. Add buttons (optional)\n` +
            `4. Add copy button (optional)\n` +
            `5. Generate shareable link\n\n` +
            `<b>📋 History:</b>\n` +
            `• View all created deep links\n` +
            `• Track usage statistics\n` +
            `• Copy existing links\n\n` +
            `<b>🚫 Ban Management:</b>\n` +
            `• Ban users by User ID\n` +
            `• Unban users\n` +
            `• View banned users list\n\n` +
            `<b>⚠️ Important:</b>\n` +
            `• Channel must be set first for posts\n` +
            `• Bot must have admin permissions\n` +
            `• Use /skip to skip caption\n` +
            `• Buttons support URL, Copy & Callback, Emoji, and Styles!\n` +
            `• Reply Keyboard also supports Emoji and Styles!`;
        
        try {
            await this.bot.editMessageText(helpText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "⬅️ Back to Admin", callback_data: "admin_back" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async getAdminStats() {
        const totalUsers = this.users.length;
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        
        const activeToday = Math.floor(totalUsers * 0.1);
        const activeWeek = Math.floor(totalUsers * 0.3);
        
        let channelReady = false;
        if (this.channelId) {
            const perms = await this.checkChannelPermissions(this.channelId);
            channelReady = perms.exists && perms.isAdmin && perms.canPost;
        }
        
        const used = process.memoryUsage();
        const memoryUsage = Math.round(used.heapUsed / 1024 / 1024) + ' MB';
        
        const uptime = this.formatUptime(process.uptime());
        
        return {
            totalUsers,
            activeToday,
            activeWeek,
            supportedDomains: this.supportedDomains.length,
            channelReady,
            memoryUsage,
            uptime,
            lastUpdate: this.formatMyanmarTime()
        };
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    // ==================== CHANNEL POST SYSTEM METHODS ====================
    
    async setPostType(chatId, type, messageId) {
        const data = this.postData[chatId];
        data.type = type;
        
        // Reset all fields for clean slate when switching type
        if (type === 'text') {
            data.media = null;
            data.caption = '';
            data.pollOptions = [];
            data.buttons = [];
            data.content = '';
        } else if (['photo', 'video', 'document', 'gif'].includes(type)) {
            data.content = '';
            data.pollOptions = [];
            data.buttons = [];
            data.caption = '';
            data.media = null;
        } else if (type === 'poll') {
            data.content = '';
            data.media = null;
            data.caption = '';
            data.buttons = [];
            data.pollOptions = [];
        }
        
        let message = "";
        if (type === 'text') {
            message = "📝 <b>Text Post Selected</b>\n\nPlease send the text for your post (HTML formatting supported):";
            data.waitingFor = 'content';
        } else if (type === 'photo') {
            message = "🖼️ <b>Photo Post Selected</b>\n\nPlease send the photo:";
            data.waitingFor = null; // will be set when photo arrives
        } else if (type === 'video') {
            message = "🎬 <b>Video Post Selected</b>\n\nPlease send the video:";
            data.waitingFor = null;
        } else if (type === 'document') {
            message = "📁 <b>Document Post Selected</b>\n\nPlease send the document:";
            data.waitingFor = null;
        } else if (type === 'gif') {
            message = "🎞️ <b>GIF Post Selected</b>\n\nPlease send the GIF:";
            data.waitingFor = null;
        } else if (type === 'poll') {
            message = "📊 <b>Poll Post Selected</b>\n\nPlease send the poll question:";
            data.waitingFor = 'content';
        }
        
        try {
            await this.bot.editMessageText(message, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "post_cancel" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }
    
    async addPostButtons(chatId, messageId) {
        // Start interactive wizard
        await this.startPostButtonWizard(chatId, messageId);
    }
    
    async processPostButtonsInput(chatId, text) {
        // This method is no longer used for interactive wizard, but kept for compatibility if needed
        // We'll ignore it and rely on wizard
    }
    
    async processPollOptions(chatId, text) {
        const data = this.postData[chatId];
        const options = text.split('\n').filter(opt => opt.trim());
        
        if (options.length < 2) {
            await this.bot.sendMessage(chatId, "⚠️ Poll must have at least 2 options!", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "post_cancel" }]
                    ]
                }
            });
            return;
        }
        
        if (options.length > 10) {
            await this.bot.sendMessage(chatId, "⚠️ Poll can have maximum 10 options!", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "post_cancel" }]
                    ]
                }
            });
            return;
        }
        
        data.pollOptions = options.slice(0, 10);
        data.waitingFor = null;
        
        const sentMessage = await this.bot.sendMessage(chatId, `✅ Poll options saved (${data.pollOptions.length} options). You can now preview or publish.`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "👁️ Preview", callback_data: "post_preview" },
                        { text: "🚀 Publish", callback_data: "post_publish" }
                    ],
                    [
                        { text: "❌ Cancel", callback_data: "post_cancel" }
                    ]
                ]
            }
        });
        this.messageTypes[sentMessage.message_id] = 'text';
    }
    
    async editPostText(chatId, messageId) {
        const data = this.postData[chatId];
        data.waitingFor = 'content';
        
        try {
            await this.bot.editMessageText("📝 <b>Edit Text</b>\n\nPlease send the new text for your post (HTML formatting supported):", {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "post_cancel" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }
    
    async editPostCaption(chatId, messageId) {
        const data = this.postData[chatId];
        data.waitingFor = 'caption';
        
        try {
            await this.bot.editMessageText("📝 <b>Edit Caption</b>\n\nPlease send the new caption for your post (HTML formatting supported):", {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "post_cancel" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }
    
    async editBroadcastText(chatId, messageId) {
        const data = this.broadcastData[chatId];
        data.waitingFor = 'content';
        
        try {
            await this.bot.editMessageText("📝 <b>Edit Broadcast Text</b>\n\nPlease send the new text for your broadcast (HTML formatting supported):", {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "broadcast_cancel" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }
    
    async editBroadcastCaption(chatId, messageId) {
        const data = this.broadcastData[chatId];
        data.waitingFor = 'caption';
        
        try {
            await this.bot.editMessageText("📝 <b>Edit Broadcast Caption</b>\n\nPlease send the new caption for your broadcast (HTML formatting supported):", {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "broadcast_cancel" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }
    
    // ==================== SAFE REPLY MARKUP BUILDER ====================
    buildSafeReplyMarkup(buttons, forChannel = false) {
        if (!buttons || buttons.length === 0) return undefined;
        const cleaned = buttons.map(row => {
            if (!Array.isArray(row)) row = [row];
            return row.map(btn => {
                const b = Object.assign({}, btn);
                // copy_text buttons: only remove icon_custom_emoji_id (style IS allowed in Bot API 9.4)
                if (b.copy_text) {
                    delete b.icon_custom_emoji_id;
                }
                return b;
            });
        });
        return { inline_keyboard: cleaned };
    }

    async previewPost(chatId, messageId) {
        const data = this.postData[chatId];
        
        if (!data.content && !data.media && data.type !== 'poll') {
            try {
                await this.bot.editMessageText("⚠️ No content to preview!", {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "❌ Cancel", callback_data: "post_cancel" }]
                        ]
                    }
                });
                this.messageTypes[messageId] = 'text';
            } catch (error) {
                console.error('Error editing message:', error);
            }
            return;
        }
        
        const replyMarkup = this.buildSafeReplyMarkup(data.buttons);
        
        try {
            if (data.type === 'text') {
                // Check if text is a script and format accordingly
                let formattedText = data.content;
                const isScript = data.content.includes('loadstring') || 
                                data.content.includes('game:HttpGet') ||
                                data.content.includes('getgenv');
                
                if (isScript) {
                    formattedText = `\`\`\`lua\n${data.content}\n\`\`\``;
                    
                    await this.bot.sendMessage(chatId, `<b>📝 Preview of Your Post:</b>\n\n${formattedText}`, {
                        parse_mode: 'Markdown',
                        reply_markup: replyMarkup
                    });
                } else {
                    await this.bot.sendMessage(chatId, `<b>📝 Preview of Your Post:</b>\n\n${data.content}`, {
                        parse_mode: 'HTML',
                        reply_markup: replyMarkup
                    });
                }
            } 
            else if (data.type === 'photo' && data.media) {
                await this.bot.sendPhoto(chatId, data.media, {
                    caption: data.caption ? `<b>🖼️ Preview:</b>\n\n${data.caption}` : undefined,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            else if (data.type === 'video' && data.media) {
                await this.bot.sendVideo(chatId, data.media, {
                    caption: data.caption ? `<b>🎬 Preview:</b>\n\n${data.caption}` : undefined,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            else if (data.type === 'document' && data.media) {
                await this.bot.sendDocument(chatId, data.media, {
                    caption: data.caption ? `<b>📁 Preview:</b>\n\n${data.caption}` : undefined,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            else if (data.type === 'gif' && data.media) {
                await this.bot.sendAnimation(chatId, data.media, {
                    caption: data.caption ? `<b>🎞️ Preview:</b>\n\n${data.caption}` : undefined,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            else if (data.type === 'poll') {
                let previewText = `<b>📊 Poll Preview:</b>\n\n<b>Question:</b> ${data.content}\n\n<b>Options:</b>\n`;
                data.pollOptions.forEach((opt, idx) => {
                    previewText += `${idx + 1}. ${opt}\n`;
                });
                
                await this.bot.sendMessage(chatId, previewText, {
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            
            if (data.buttons.length > 0) {
                let layoutInfo = `\n<b>📊 Button Layout:</b>\n`;
                data.buttons.forEach((row, rowIndex) => {
                    layoutInfo += `Row ${rowIndex + 1}: `;
                    row.forEach((btn, btnIndex) => {
                        layoutInfo += `[${btn.text}${btn.icon_custom_emoji_id ? '✨' : ''}${btn.style ? '🎨' : ''}]`;
                        if (btnIndex < row.length - 1) layoutInfo += ' ↔ ';
                    });
                    layoutInfo += '\n';
                });
                
                await this.bot.sendMessage(chatId, layoutInfo, {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "🚀 Publish to Channel", callback_data: "post_publish" },
                                { text: "🔗 Edit Layout", callback_data: "post_buttons" }
                            ],
                            [
                                { text: "📝 Edit Text", callback_data: "post_edit_text" },
                                { text: "👁️ Preview Again", callback_data: "post_preview" }
                            ],
                            [
                                { text: "❌ Cancel", callback_data: "post_cancel" }
                            ]
                        ]
                    }
                });
            } else {
                await this.bot.sendMessage(chatId, "👆 This is how your post will look in the channel. Publish now?", {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "🚀 Publish to Channel", callback_data: "post_publish" },
                                { text: "🔗 Add Buttons", callback_data: "post_buttons" }
                            ],
                            [
                                { text: "📝 Edit Text", callback_data: "post_edit_text" },
                                { text: "👁️ Preview Again", callback_data: "post_preview" }
                            ],
                            [
                                { text: "❌ Cancel", callback_data: "post_cancel" }
                            ]
                        ]
                    }
                });
            }
        } catch (error) {
            console.error('Preview error:', error);
            await this.bot.sendMessage(chatId, "❌ Error creating preview.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "post_cancel" }]
                    ]
                }
            });
        }
    }
    
    async checkAndShowChannelPermissions(chatId, messageId) {
        const data = this.postData[chatId];
        const channelId = data?.channelId || this.channelId;
        
        if (!channelId) {
            try {
                await this.bot.editMessageText("❌ No channel ID set!", {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "❌ Cancel", callback_data: "post_cancel" }]
                        ]
                    }
                });
                this.messageTypes[messageId] = 'text';
            } catch (error) {
                console.error('Error editing message:', error);
            }
            return false;
        }
        
        const perms = await this.checkChannelPermissions(channelId);
        
        if (!perms.exists) {
            try {
                await this.bot.editMessageText(`❌ Channel not found: <code>${channelId}</code>`, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "❌ Cancel", callback_data: "post_cancel" }]
                        ]
                    }
                });
                this.messageTypes[messageId] = 'text';
            } catch (error) {
                console.error('Error editing message:', error);
            }
            return false;
        }
        
        if (!perms.isAdmin || !perms.canPost) {
            let errorMsg = `❌ Bot cannot post to channel <code>${channelId}</code>\n\n`;
            errorMsg += `• Admin: ${perms.isAdmin ? '✅' : '❌'}\n`;
            errorMsg += `• Can Post: ${perms.canPost ? '✅' : '❌'}\n\n`;
            errorMsg += "Please make sure:\n1. Bot is added to channel as admin\n2. Bot has 'Post Messages' permission";
            
            try {
                await this.bot.editMessageText(errorMsg, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🔄 Check Again", callback_data: "post_check_perms" }],
                            [{ text: "❌ Cancel", callback_data: "post_cancel" }]
                        ]
                    }
                });
                this.messageTypes[messageId] = 'text';
            } catch (error) {
                console.error('Error editing message:', error);
            }
            return false;
        }
        
        return true;
    }
    
    async publishPost(chatId, messageId) {
        const data = this.postData[chatId];
        
        if (!data.content && !data.media && data.type !== 'poll') {
            try {
                await this.bot.editMessageText("⚠️ No content to publish!", {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "❌ Cancel", callback_data: "post_cancel" }]
                        ]
                    }
                });
                this.messageTypes[messageId] = 'text';
            } catch (error) {
                console.error('Error editing message:', error);
            }
            return;
        }
        
        const canPublish = await this.checkAndShowChannelPermissions(chatId, messageId);
        if (!canPublish) {
            return;
        }
        
        const replyMarkup = this.buildSafeReplyMarkup(data.buttons);
        
        try {
            await this.bot.editMessageText("📤 Publishing post to channel...", {
                chat_id: chatId,
                message_id: messageId
            });
            this.messageTypes[messageId] = 'text';
            
            let result;
            if (data.type === 'text') {
                // Check if text is a script and format accordingly
                let formattedText = data.content;
                const isScript = data.content.includes('loadstring') || 
                                data.content.includes('game:HttpGet') ||
                                data.content.includes('getgenv');
                
                if (isScript) {
                    formattedText = `\`${data.content}\``;
                    
                    result = await this.bot.sendMessage(data.channelId, formattedText, {
                        parse_mode: 'Markdown',
                        reply_markup: replyMarkup
                    });
                } else {
                    result = await this.bot.sendMessage(data.channelId, data.content, {
                        parse_mode: 'HTML',
                        reply_markup: replyMarkup
                    });
                }
            }
            else if (data.type === 'photo' && data.media) {
                result = await this.bot.sendPhoto(data.channelId, data.media, {
                    caption: data.caption,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            else if (data.type === 'video' && data.media) {
                result = await this.bot.sendVideo(data.channelId, data.media, {
                    caption: data.caption,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            else if (data.type === 'document' && data.media) {
                result = await this.bot.sendDocument(data.channelId, data.media, {
                    caption: data.caption,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            else if (data.type === 'gif' && data.media) {
                result = await this.bot.sendAnimation(data.channelId, data.media, {
                    caption: data.caption,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            else if (data.type === 'poll') {
                result = await this.bot.sendPoll(data.channelId, data.content, data.pollOptions, {
                    is_anonymous: false,
                    allows_multiple_answers: false,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            }
            
            let successMsg = `✅ Post successfully published to <code>${data.channelId}</code>!\n\n`;
            
            if (data.buttons.length > 0) {
                successMsg += `<b>Button Layout Summary:</b>\n`;
                successMsg += `• Total Rows: ${data.buttons.length}\n`;
                data.buttons.forEach((row, index) => {
                    successMsg += `• Row ${index + 1}: ${row.length} button(s)\n`;
                });
            }
            
            const postLink = `https://t.me/c/${data.channelId.replace('@', '').replace('-100', '')}/${result.message_id}`;
            successMsg += `\n🔗 <a href="${postLink}">View Post in Channel</a>`;
            
            await this.bot.editMessageText(successMsg, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
            this.messageTypes[messageId] = 'text';
            
            // Clean up state on success
            delete this.postMode[chatId];
            delete this.postData[chatId];
            delete this.selectedChannelForPost[chatId];
            
        } catch (error) {
            console.error('Publish error:', error);
            let errorMsg = "❌ Failed to publish post:\n";
            
            if (error.message.includes('CHAT_NOT_FOUND') || error.message.includes('chat not found')) {
                errorMsg += "• Channel not found\n• Make sure bot is admin in channel";
            } else if (error.message.includes('not enough rights')) {
                errorMsg += "• Bot doesn't have permission to post\n• Make sure bot is admin with post permission";
            } else if (error.message.includes('ETELEGRAM: 400')) {
                errorMsg += "• Invalid channel ID or bot not in channel";
            } else {
                errorMsg += error.message;
            }
            
            try {
                await this.bot.editMessageText(errorMsg, {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🔄 Try Again", callback_data: "post_publish" }],
                            [{ text: "🔧 Fix Permissions", callback_data: "post_check_perms" }],
                            [{ text: "❌ Cancel", callback_data: "post_cancel" }]
                        ]
                    }
                });
                this.messageTypes[messageId] = 'text';
            } catch (editError) {
                console.error('Error editing message:', editError);
            }
            
            // Clean up state on error too
            delete this.postMode[chatId];
            delete this.postData[chatId];
            delete this.selectedChannelForPost[chatId];
        }
    }
    
    async cancelPost(chatId, messageId) {
        delete this.postMode[chatId];
        delete this.postData[chatId];
        delete this.selectedChannelForPost[chatId];
        delete this.postButtonWizard[chatId];
        
        try {
            await this.bot.editMessageText("❌ Post creation cancelled.", {
                chat_id: chatId,
                message_id: messageId
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }
    
    async checkChannelPermissions(channelId) {
        try {
            const chat = await this.bot.getChat(channelId);
            
            const me = await this.bot.getMe();
            const member = await this.bot.getChatMember(channelId, me.id);
            
            const isAdmin = ['administrator', 'creator'].includes(member.status);
            const canPost = member.can_post_messages || false;
            
            return {
                exists: true,
                isAdmin: isAdmin,
                canPost: canPost,
                chat: chat
            };
        } catch (error) {
            console.error('Channel permission check error:', error.message);
            return {
                exists: false,
                isAdmin: false,
                canPost: false,
                error: error.message
            };
        }
    }

    // ==================== BROADCAST METHODS ====================
    async setBroadcastType(chatId, type, messageId) {
        this.broadcastData[chatId].type = type;
        
        let message = "";
        if (type === 'text') {
            message = "📝 <b>Text Broadcast Selected</b>\n\nPlease send the text message you want to broadcast (HTML formatting supported):";
            this.broadcastData[chatId].waitingFor = 'content';
        } else if (type === 'photo') {
            message = "🖼️ <b>Photo Broadcast Selected</b>\n\nPlease send the photo you want to broadcast:";
        } else if (type === 'video') {
            message = "🎬 <b>Video Broadcast Selected</b>\n\nPlease send the video you want to broadcast:";
        } else if (type === 'document') {
            message = "📁 <b>Document Broadcast Selected</b>\n\nPlease send the document you want to broadcast:";
        } else if (type === 'gif') {
            message = "🎞️ <b>GIF Broadcast Selected</b>\n\nPlease send the GIF you want to broadcast:";
        } else if (type === 'sticker') {
            message = "😀 <b>Sticker Broadcast Selected</b>\n\nPlease send the sticker you want to broadcast:";
        }
        
        try {
            await this.bot.editMessageText(message, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "broadcast_cancel" }]
                    ]
                }
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    async addBroadcastButtons(chatId, messageId) {
        // Start interactive wizard
        await this.startBroadcastButtonWizard(chatId, messageId);
    }

    async processButtonsInput(chatId, text) {
        // This method is no longer used for interactive wizard, but kept for compatibility if needed
    }

    async previewBroadcast(chatId, messageId) {
        const data = this.broadcastData[chatId];
        
        if (!data.content && !data.media) {
            try {
                await this.bot.editMessageText("⚠️ No content to preview! Please add content first.", {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "❌ Cancel", callback_data: "broadcast_cancel" }]
                        ]
                    }
                });
                this.messageTypes[messageId] = 'text';
            } catch (error) {
                console.error('Error editing message:', error);
            }
            return;
        }
        
        const replyMarkup = this.buildSafeReplyMarkup(data.buttons);
        
        try {
            if (data.type === 'text') {
                // Check if text is a script and format accordingly
                let formattedText = data.content;
                const isScript = data.content.includes('loadstring') || 
                                data.content.includes('game:HttpGet') ||
                                data.content.includes('getgenv');
                
                if (isScript) {
                    formattedText = `\`\`\`lua\n${data.content}\n\`\`\``;
                    
                    await this.bot.sendMessage(chatId, `<b>📝 Preview of Your Broadcast:</b>\n\n${formattedText}`, {
                        parse_mode: 'Markdown',
                        reply_markup: replyMarkup
                    });
                } else {
                    await this.bot.sendMessage(chatId, `<b>📝 Preview of Your Broadcast:</b>\n\n${data.content}`, {
                        parse_mode: 'HTML',
                        reply_markup: replyMarkup
                    });
                }
            } else if (data.type === 'photo' && data.media) {
                await this.bot.sendPhoto(chatId, data.media, {
                    caption: data.caption ? `<b>🖼️ Preview of Your Broadcast:</b>\n\n${data.caption}` : undefined,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            } else if (data.type === 'video' && data.media) {
                await this.bot.sendVideo(chatId, data.media, {
                    caption: data.caption ? `<b>🎬 Preview of Your Broadcast:</b>\n\n${data.caption}` : undefined,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            } else if (data.type === 'document' && data.media) {
                await this.bot.sendDocument(chatId, data.media, {
                    caption: data.caption ? `<b>📁 Preview of Your Broadcast:</b>\n\n${data.caption}` : undefined,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            } else if (data.type === 'gif' && data.media) {
                await this.bot.sendAnimation(chatId, data.media, {
                    caption: data.caption ? `<b>🎞️ Preview of Your Broadcast:</b>\n\n${data.caption}` : undefined,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                });
            } else if (data.type === 'sticker' && data.media) {
                await this.bot.sendSticker(chatId, data.media, {
                    reply_markup: replyMarkup
                });
            }
            
            await this.bot.sendMessage(chatId, "👆 This is how your broadcast will look to users. Send it now?", {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "🚀 Send to All Users", callback_data: "broadcast_send" },
                            { text: "🔗 Edit Layout", callback_data: "broadcast_buttons" }
                        ],
                        [
                            { text: "📝 Edit Text", callback_data: "broadcast_edit_text" },
                            { text: "👁️ Preview Again", callback_data: "broadcast_preview" }
                        ],
                        [
                            { text: "❌ Cancel", callback_data: "broadcast_cancel" }
                        ]
                    ]
                }
            });
        } catch (error) {
            console.error('Preview error:', error);
            await this.bot.sendMessage(chatId, "❌ Error creating preview. Please check your content and try again.", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "❌ Cancel", callback_data: "broadcast_cancel" }]
                    ]
                }
            });
        }
    }

    async sendBroadcast(chatId, messageId) {
        const data = this.broadcastData[chatId];
        const totalUsers = this.users.length;
        let successCount = 0;
        let failedCount = 0;
        
        if (!data.content && !data.media) {
            try {
                await this.bot.editMessageText("⚠️ No content to broadcast! Please add content first.", {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "❌ Cancel", callback_data: "broadcast_cancel" }]
                        ]
                    }
                });
                this.messageTypes[messageId] = 'text';
            } catch (error) {
                console.error('Error editing message:', error);
            }
            return;
        }
        
        const replyMarkup = this.buildSafeReplyMarkup(data.buttons);
        
        try {
            await this.bot.editMessageText(`📢 Starting broadcast to ${totalUsers} users...`, {
                chat_id: chatId,
                message_id: messageId
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
        
        for (const userId of this.users) {
            // Skip banned users
            if (this.isBanned(userId.toString())) {
                failedCount++;
                continue;
            }
            
            try {
                // Get user info for personalization
                let userInfo;
                try {
                    const chat = await this.bot.getChat(userId);
                    userInfo = {
                        id: userId,
                        first_name: chat.first_name || 'User',
                        username: chat.username || ''
                    };
                } catch {
                    userInfo = {
                        id: userId,
                        first_name: 'User',
                        username: ''
                    };
                }
                
                if (data.type === 'text') {
                    // Personalize the text
                    let personalizedText = this.personalizeText(data.content, userInfo);
                    
                    // Check if text is a script and format accordingly
                    const isScript = personalizedText.includes('loadstring') || 
                                    personalizedText.includes('game:HttpGet') ||
                                    personalizedText.includes('getgenv');
                    
                    if (isScript) {
                        personalizedText = `\`${personalizedText}\``;
                        
                        await this.bot.sendMessage(userId, personalizedText, {
                            parse_mode: 'Markdown',
                            reply_markup: replyMarkup
                        });
                    } else {
                        await this.bot.sendMessage(userId, personalizedText, {
                            parse_mode: 'HTML',
                            reply_markup: replyMarkup
                        });
                    }
                } else if (data.type === 'photo' && data.media) {
                    let caption = data.caption ? this.personalizeText(data.caption, userInfo) : undefined;
                    await this.bot.sendPhoto(userId, data.media, {
                        caption: caption,
                        parse_mode: 'HTML',
                        reply_markup: replyMarkup
                    });
                } else if (data.type === 'video' && data.media) {
                    let caption = data.caption ? this.personalizeText(data.caption, userInfo) : undefined;
                    await this.bot.sendVideo(userId, data.media, {
                        caption: caption,
                        parse_mode: 'HTML',
                        reply_markup: replyMarkup
                    });
                } else if (data.type === 'document' && data.media) {
                    let caption = data.caption ? this.personalizeText(data.caption, userInfo) : undefined;
                    await this.bot.sendDocument(userId, data.media, {
                        caption: caption,
                        parse_mode: 'HTML',
                        reply_markup: replyMarkup
                    });
                } else if (data.type === 'gif' && data.media) {
                    let caption = data.caption ? this.personalizeText(data.caption, userInfo) : undefined;
                    await this.bot.sendAnimation(userId, data.media, {
                        caption: caption,
                        parse_mode: 'HTML',
                        reply_markup: replyMarkup
                    });
                } else if (data.type === 'sticker' && data.media) {
                    await this.bot.sendSticker(userId, data.media, {
                        reply_markup: replyMarkup
                    });
                }
                
                successCount++;
                
                if (successCount % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    try {
                        await this.bot.editMessageText(`📢 Broadcasting... ${successCount}/${totalUsers} users`, {
                            chat_id: chatId,
                            message_id: messageId
                        });
                        this.messageTypes[messageId] = 'text';
                    } catch (error) {
                        // Ignore edit errors
                    }
                }
            } catch (error) {
                console.error(`Failed to send to user ${userId}:`, error.message);
                failedCount++;
            }
        }
        
        const successRate = totalUsers > 0 ? ((successCount / totalUsers) * 100).toFixed(1) : 0;
        const completionMsg =
            `<tg-emoji emoji-id="6269163801178804220">✅</tg-emoji> <b>Broadcast Completed!</b>\n\n` +
            `<tg-emoji emoji-id="5368324170671202286">👥</tg-emoji> <b>Total Users:</b> <code>${totalUsers}</code>\n` +
            `<tg-emoji emoji-id="5350618807943576963">✅</tg-emoji> <b>Sent:</b> <code>${successCount}</code>\n` +
            `<tg-emoji emoji-id="5258084656674250503">❌</tg-emoji> <b>Failed:</b> <code>${failedCount}</code>\n` +
            `<tg-emoji emoji-id="6053323501073341449">📊</tg-emoji> <b>Success Rate:</b> <code>${successRate}%</code>`;

        // Store last broadcast stats
        this.lastBroadcastStats = { totalUsers, successCount, failedCount, successRate, time: Date.now() };

        try {
            await this.bot.editMessageText(completionMsg, {
                chat_id: chatId, message_id: messageId, parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[
                    { text: 'View Stats', callback_data: 'broadcast_last_stats', icon_custom_emoji_id: '5350618807943576963', style: 'success' },
                    { text: 'Admin Panel', callback_data: 'admin_panel', icon_custom_emoji_id: '6280276539430932448', style: 'primary' }
                ]]}
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) { console.error('Error editing message:', error); }
        
        delete this.broadcastMode[chatId];
        delete this.broadcastData[chatId];
    }

    async cancelBroadcast(chatId, messageId) {
        delete this.broadcastMode[chatId];
        delete this.broadcastData[chatId];
        delete this.broadcastButtonWizard[chatId];
        
        try {
            await this.bot.editMessageText("❌ Broadcast cancelled.", {
                chat_id: chatId,
                message_id: messageId
            });
            this.messageTypes[messageId] = 'text';
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }

    // ==================== USER MANAGEMENT METHODS ====================

    // ==================== NEW: Check channel membership for ANY chat type ====================
    // This checks if user joined required channels regardless of private/group context
    async checkChannelMembership(userId) {
        const missingChannels = [];
        for (const channel of this.requiredChannels) {
            try {
                const member = await this.bot.getChatMember(channel.id, userId);
                if (!['member', 'administrator', 'creator'].includes(member.status)) {
                    missingChannels.push(channel);
                }
            } catch (error) {
                console.error(`Error checking channel ${channel.id}:`, error.message);
                missingChannels.push(channel);
            }
        }
        return missingChannels;
    }

    async checkUserJoinStatus(chatId, userId, messageId = null) {
        try {
            // FIX: Check if chat is private - skip join check for private chats
            const chat = await this.bot.getChat(chatId);
            if (chat.type === 'private') {
                // Private chat - no join requirement
                return [];
            }
            
            // Group chat - check channel membership
            const missingChannels = [];
            
            for (const channel of this.requiredChannels) {
                try {
                    const member = await this.bot.getChatMember(channel.id, userId);
                    const status = member.status;
                    
                    if (!['member', 'administrator', 'creator'].includes(status)) {
                        missingChannels.push(channel);
                    }
                } catch (error) {
                    console.error(`Error checking channel ${channel.id}:`, error.message);
                    missingChannels.push(channel);
                }
            }
            
            this.userJoinStatus[userId] = {
                missing: missingChannels,
                timestamp: Date.now()
            };
            
            if (messageId) {
                if (missingChannels.length === 0) {
                    try {
                        await this.bot.editMessageText(this.getText(chatId, 'join_success'), {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'HTML',
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: this.getText(chatId, 'button_back'), callback_data: "back_menu", icon_custom_emoji_id: "5258084656674250503", style: "success" }
                                    ]
                                ]
                            }
                        });
                        this.messageTypes[messageId] = 'text';
                    } catch (error) {
                        console.error('Error editing message:', error);
                    }
                } else {
                    await this.showJoinRequiredMessage(chatId, missingChannels, messageId);
                }
            }
            
            return missingChannels;
            
        } catch (error) {
            console.error('Error checking join status:', error);
            // If we can't check, assume all channels are required
            return this.requiredChannels;
        }
    }

    async forceCheckJoinStatus(chatId, userId, messageId) {
        delete this.userJoinStatus[userId];
        await this.checkUserJoinStatus(chatId, userId, messageId);
    }

    async showJoinRequiredMessage(chatId, missingChannels, messageId = null, replyToMessageId = null, userId = null) {
        let message = `${this.getText(chatId, 'join_required')}\n\n`;
        
        missingChannels.forEach((channel, index) => {
            message += `• ${channel.name}\n`;
        });
        
        message += `\n${this.getText(chatId, 'join_check')}`;
        
        const buttons = [];
        
        for (let i = 0; i < missingChannels.length; i += 2) {
            const row = [];
            if (missingChannels[i]) {
                row.push({ 
                    text: `${i+1}. ${missingChannels[i].name}`, 
                    url: missingChannels[i].url,
                    style: "primary"
                });
            }
            if (missingChannels[i + 1]) {
                row.push({ 
                    text: `${i+2}. ${missingChannels[i + 1].name}`, 
                    url: missingChannels[i + 1].url,
                    style: "primary"
                });
            }
            buttons.push(row);
        }
        
        buttons.push([
            { text: this.getText(chatId, 'button_joined'), callback_data: "check_join", style: "primary" },
            { text: this.getText(chatId, 'button_refresh'), callback_data: "refresh_join", style: "primary" }
        ]);
        
        const replyMarkup = { inline_keyboard: buttons };
        const options = {
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
            reply_to_message_id: replyToMessageId || null
        };

        if (messageId) {
            try {
                await this.bot.editMessageText(message, {
                    chat_id: chatId,
                    message_id: messageId,
                    ...options
                });
                this.messageTypes[messageId] = 'text';
            } catch (error) {
                console.error('Error editing join message:', error);
                const sentMessage = await this.bot.sendMessage(chatId, message, options);
                this.messageTypes[sentMessage.message_id] = 'text';
            }
        } else {
            const sentMessage = await this.bot.sendMessage(chatId, message, options);
            this.messageTypes[sentMessage.message_id] = 'text';
            // Group: auto-delete join msg + user msg after 60s if user doesn't join
            if (userId && replyToMessageId) {
                const timerKey = `${userId}_${chatId}`;
                if (this.joinMsgTimers[timerKey]) clearTimeout(this.joinMsgTimers[timerKey]);
                this.joinMsgTimers[timerKey] = setTimeout(async () => {
                    await this.bot.deleteMessage(chatId, sentMessage.message_id).catch(() => {});
                    await this.bot.deleteMessage(chatId, replyToMessageId).catch(() => {});
                    delete this.joinMsgTimers[timerKey];
                    // Clean up pending bypass too
                    if (this.pendingBypassRequests[userId]) delete this.pendingBypassRequests[userId];
                }, 60000);
            }
        }
    }

    // ==================== CORE BOT METHODS ====================

    async sendWelcomeMessage(chatId, userId, username, firstName, messageId = null) {
        try {
            const chat = await this.bot.getChat(chatId);
            const isGroup = chat.type !== 'private';
            
            const caption = this.getText(chatId, 'welcome', userId, username, firstName);
            
            const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
            const buttons = [
                [
                    { text: isEn ? 'Language' : 'ဘာသာ',   callback_data: "language",         icon_custom_emoji_id: "6339280615459789282", style: "primary" },
                    { text: isEn ? 'Support' : 'ထောက်ပံ့', callback_data: "support",           icon_custom_emoji_id: "5339141594471742013", style: "success" }
                ],
                [
                    { text: isEn ? 'Donate' : 'လှူဒါန်း',  callback_data: "user_supporting",   icon_custom_emoji_id: "5190859184312167965", style: "primary" },
                    { text: isEn ? 'Feedback' : 'အကြံပြု',callback_data: "user_feedback",      icon_custom_emoji_id: "5433811242135331842", style: "success" }
                ],
                [
                    { text: isEn ? 'Script Key Bypass' : 'Script Key Bypass', callback_data: "script_key_bypass", icon_custom_emoji_id: "5454386656628991407", style: "danger" }
                ],
                [
                    { text: isEn ? 'WarpGen' : 'WarpGen',  callback_data: "warp_generate",     icon_custom_emoji_id: "5350618807943576963", style: "primary" },
                    { text: isEn ? 'Catbox Upload' : 'ဖိုင်တင်', callback_data: "catbox_menu",icon_custom_emoji_id: "5260450573768990626", style: "success" }
                ],
                [
                    { text: isEn ? 'Downloader' : 'ဒေါင်းလုဒ်',callback_data: "smartdl_menu", icon_custom_emoji_id: "5341715473882955310", style: "success" },
                    { text: isEn ? 'Music' : 'သီချင်း',    callback_data: "song_menu",          icon_custom_emoji_id: "5350618807943576963", style: "primary" }
                ]
            ];

            // web_app buttons only work in private chats
            if (!isGroup) {
                buttons.splice(1, 0, [
                    { 
                        text: this.getText(chatId, 'button_miniapp'),
                        web_app: { url: "https://kopudding.free.nf/" },
                        icon_custom_emoji_id: "5341715473882955310",
                        style: "danger"
                    }
                ]);
            }
            
            if (this.isAdmin(userId.toString())) {
                buttons.push([
                    { 
                        text: "Admin Panel",
                        callback_data: "admin_panel",
                        icon_custom_emoji_id: "6280276539430932448",
                        style: "success"
                    }
                ]);
            }
            
            const photoUrl = 'https://ar-hosting.pages.dev/1772707114723.jpg';
            const sendPhotoOpts = {
                caption,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: buttons },
                ...(isGroup && messageId ? { reply_to_message_id: messageId } : {})
            };
            try {
                const sentMessage = await this.bot.sendPhoto(chatId, photoUrl, sendPhotoOpts);
                this.messageTypes[sentMessage.message_id] = 'photo';
            } catch (photoErr) {
                // Fallback to text if photo fails
                try {
                    const sentMessage = await this.bot.sendMessage(chatId, caption, {
                        parse_mode: 'HTML',
                        reply_markup: { inline_keyboard: buttons }
                    });
                    this.messageTypes[sentMessage.message_id] = 'text';
                } catch {}
            }

        } catch (error) {
            console.error('Welcome message error:', error);
            const caption = this.getText(chatId, 'welcome', userId, username, firstName);
            try {
                await this.bot.sendMessage(chatId, caption, { parse_mode: 'HTML' });
            } catch (e) {
                await this.bot.sendMessage(chatId, `Hello ${firstName}! Welcome to RKE Bypass Bot.`);
            }
        }
    }

    async goBackToMenu(chatId, messageId, user) {
        const userId = user.id;
        const username = user.username || 'N/A';
        const firstName = user.first_name || 'User';
        
        // FIX: Check if chat is private - skip join check for private chats
        const chat = await this.bot.getChat(chatId);
        
        if (chat.type !== 'private') {
            // Group chat - check join status
            const missingChannels = await this.checkUserJoinStatus(chatId, userId);
            
            if (missingChannels.length > 0) {
                await this.showJoinRequiredMessage(chatId, missingChannels, messageId);
                return;
            }
        }
        // Private chat - no join check needed
        
        const welcomeMessage = this.getText(chatId, 'welcome', userId, username, firstName);
        
        const isEn2 = (this.userLanguages?.[chatId] || 'en') === 'en';
        const buttons = [
            [
                { text: isEn2 ? 'Language' : 'ဘာသာ',   callback_data: "language",         icon_custom_emoji_id: "6339280615459789282", style: "primary" },
                { text: isEn2 ? 'Support' : 'ထောက်ပံ့', callback_data: "support",           icon_custom_emoji_id: "5339141594471742013", style: "success" }
            ],
            [
                { text: this.getText(chatId, 'button_miniapp'), web_app: { url: "https://kopudding.free.nf/" }, icon_custom_emoji_id: "5341715473882955310", style: "danger" }
            ],
            [
                { text: isEn2 ? 'Donate' : 'လှူဒါန်း',  callback_data: "user_supporting",   icon_custom_emoji_id: "5190859184312167965", style: "primary" },
                { text: isEn2 ? 'Feedback' : 'အကြံပြု',  callback_data: "user_feedback",     icon_custom_emoji_id: "5433811242135331842", style: "success" }
            ],
            [
                { text: 'Script Key Bypass', callback_data: "script_key_bypass", icon_custom_emoji_id: "5454386656628991407", style: "danger" }
            ],
            [
                { text: 'WarpGen',                       callback_data: "warp_generate",     icon_custom_emoji_id: "5350618807943576963", style: "primary" },
                { text: isEn2 ? 'Catbox Upload' : 'ဖိုင်တင်', callback_data: "catbox_menu",  icon_custom_emoji_id: "5260450573768990626", style: "success" }
            ],
            [
                { text: isEn2 ? 'Downloader' : 'ဒေါင်းလုဒ်', callback_data: "smartdl_menu", icon_custom_emoji_id: "5341715473882955310", style: "success" },
                { text: isEn2 ? 'Music' : 'သီချင်း',      callback_data: "song_menu",         icon_custom_emoji_id: "5350618807943576963", style: "primary" }
            ]
        ];
        
        if (this.isAdmin(userId.toString())) {
            buttons.push([
                { text: "Admin Panel", callback_data: "admin_panel", icon_custom_emoji_id: "6280276539430932448", style: "success" }
            ]);
        }

        // Edit existing message instead of sending new one
        try {
            await this.bot.editMessageText(welcomeMessage, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: buttons }
            });
            this.messageTypes[messageId] = 'text';
        } catch {
            const sentMessage = await this.bot.sendMessage(chatId, welcomeMessage, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: buttons }
            });
            this.messageTypes[sentMessage.message_id] = 'text';
        }
    }

    // FIX: Improved bypass request handling
    async processBypassRequest(chatId, url, originalMessageId, userId) {
        try {
            const chat = await this.bot.getChat(chatId);
            const isPrivate = chat.type === 'private';

            // Check channel membership for ALL chats (private + group)
            const missingChannels = await this.checkChannelMembership(userId);
            
            if (missingChannels.length > 0) {
                // Store pending bypass request so it runs after join
                this.pendingBypassRequests[userId] = {
                    chatId,
                    url,
                    originalMessageId,
                    timestamp: Date.now()
                };
                // Show join required as REPLY to user's message (keep user msg visible)
                await this.showJoinRequiredMessage(chatId, missingChannels, null, originalMessageId, userId);
                return;
            }
            
            // Check for special domain handling
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            if (hostname === 'ads.luarmor.net') {
                // Block if admin disabled Script Bypass
                if (!this.scriptBypassEnabled) {
                    await this.bot.sendMessage(chatId,
                        `<tg-emoji emoji-id="6269316311172518259">😭</tg-emoji> <b>𝖲𝖼𝗋𝗂𝗉𝗍 𝖪𝖾𝗒 𝖡𝗒𝗉𝖺𝗌𝗌 𝖭𝗈𝗍 𝗒𝖾𝗍 𝖠𝗏𝖺𝗂𝗅𝖺𝖻𝗅𝖾, 𝖴𝗇𝖽𝖾𝗋 𝖱𝖾𝗉𝖺𝗂𝗋</b>`,
                        { parse_mode: 'HTML', reply_to_message_id: originalMessageId }
                    );
                    return;
                }
                await this.handleLuarmorRequest(chatId, url, originalMessageId, userId);
                return;
            }
            
            // Domain check removed - let the API decide if supported or not
            
            let processingMessage;
            const startTime = Date.now();
            
            try {
                processingMessage = await this.bot.sendMessage(chatId,
                    this.getText(chatId, 'processing'),
                    { parse_mode: 'HTML', reply_to_message_id: originalMessageId }
                );



                const encodedUrl = encodeURIComponent(url);
                const urlHostname = new URL(url).hostname.toLowerCase().replace('www.', '');
                let response;

                // loot-link.com → show "You Cannot Bypass" + Mini App button
                if (urlHostname === 'loot-link.com' || urlHostname.endsWith('.loot-link.com')) {
                    await this.bot.deleteMessage(chatId, processingMessage.message_id).catch(() => {});
                    const chat2 = await this.bot.getChat(chatId).catch(() => ({ type: 'private' }));
                    const isMiniApp = chat2.type === 'private';
                    const lootMsg = await this.bot.sendMessage(chatId,
                        `<tg-emoji emoji-id="5258093637450866522">🤖</tg-emoji> <b>𝖸𝗈𝗎 𝖢𝖺𝗇𝗇𝗈𝗍 𝖡𝗒𝗉𝖺𝗌𝗌 𝖳𝗁𝖾 𝖪𝖾𝗒 𝖫𝗂𝗇𝗄 𝖸𝗈𝗎 𝖶𝗂𝗅𝗅 𝖧𝖺𝗏𝖾 𝗍𝗈 𝖡𝗒𝗉𝖺𝗌𝗌 𝗂𝗍 𝖨𝗇 𝖳𝗁𝖾 𝖱𝖪𝖤 𝖪𝖾𝗒 𝖡𝗒𝗉𝖺𝗌𝗌 𝖬𝗂𝗇𝗂 𝖠𝗉𝗉</b>`,
                        {
                            parse_mode: 'HTML',
                            reply_to_message_id: originalMessageId,
                            reply_markup: isMiniApp
                                ? { inline_keyboard: [[{ text: 'RKE Key Bypass', web_app: { url: 'https://kopudding.free.nf/' }, icon_custom_emoji_id: '5258093637450866522', style: 'danger' }]] }
                                : { inline_keyboard: [[{ text: 'RKE Key Bypass Bot', url: 'https://t.me/RKE_blox_bypass_bot', icon_custom_emoji_id: '5258093637450866522', style: 'danger' }]] }
                        }
                    ).catch(() => null);
                    setTimeout(async () => {
                        await Promise.all([
                            originalMessageId ? this.bot.deleteMessage(chatId, originalMessageId).catch(() => {}) : Promise.resolve(),
                            lootMsg ? this.bot.deleteMessage(chatId, lootMsg.message_id).catch(() => {}) : Promise.resolve()
                        ]);
                    }, this.failedAutoDeleteDelay);
                    return;
                }

                // All other domains → Main API bypass
                response = await axios.get(`${this.apiBase}/bypass?url=${encodedUrl}`, {
                    headers: { 'x-api-key': this.apiKey },
                    timeout: this.bypassTimeout
                });

                const endTime = Date.now();
                const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

                if (response.data && response.data.result) {
                    // Sanitize result - remove ALL control chars that break copy_text
                    const bypassedResult = String(response.data.result)
                        .replace(/[\x00-\x1F\x7F]/g, '') // strip control chars
                        .replace(/\s+/g, ' ')
                        .trim();
                    const domainName = this.extractCleanDomain(url);
                    const resultMessage = this.getText(chatId, 'bypass_success', domainName, timeTaken, bypassedResult);

                    // Try with copy_text button first, fallback to plain message
                    let resultMessageObj;
                    try {
                        resultMessageObj = await this.bot.editMessageText(resultMessage, {
                            chat_id: chatId,
                            message_id: processingMessage.message_id,
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: [[
                                { text: this.getText(chatId, 'button_copy'), copy_text: { text: bypassedResult }, style: 'success' }
                            ]] }
                        });
                    } catch (btnErr) {
                        // copy_text failed (e.g. BUTTON_COPY_TEXT_INVALID) → send without button
                        console.log('[Bypass] copy_text btn failed, sending plain:', btnErr.message);
                        try {
                            resultMessageObj = await this.bot.editMessageText(resultMessage, {
                                chat_id: chatId,
                                message_id: processingMessage.message_id,
                                parse_mode: 'HTML'
                            });
                        } catch {
                            resultMessageObj = await this.bot.sendMessage(chatId, resultMessage, {
                                parse_mode: 'HTML',
                                reply_to_message_id: originalMessageId
                            });
                        }
                    }

                    // Auto-delete all msgs simultaneously after delay
                    setTimeout(async () => {
                        await Promise.all([
                            originalMessageId ? this.bot.deleteMessage(chatId, originalMessageId).catch(() => {}) : Promise.resolve(),
                            this.bot.deleteMessage(chatId, processingMessage.message_id).catch(() => {}),
                            resultMessageObj ? this.bot.deleteMessage(chatId, resultMessageObj.message_id).catch(() => {}) : Promise.resolve()
                        ]);
                    }, this.autoDeleteDelay);

                } else {
                    throw new Error('No result from API');
                }

            } catch (error) {
                console.error('❌ Bypass error details:', error.message);
                const endTime = Date.now();
                const timeTaken = ((endTime - startTime) / 1000).toFixed(2);
                if (processingMessage) await this.bot.deleteMessage(chatId, processingMessage.message_id).catch(() => {});

                const errBody = error.response?.data?.result || error.response?.data?.message || error.message || '';
                const errStr = typeof errBody === 'string' ? errBody.toLowerCase() : '';
                const isExpired = errStr.includes('expired') || errStr.includes('session') || errStr.includes('new link');

                let failMsg;
                let failMarkupToUse = null;

                if (isExpired) {
                    // Expired session
                    failMsg = this.getText(chatId, 'expired_session');
                } else {
                    // Real bypass failure → show proper error message
                    let reason = 'Bypass failed. Please try again.';
                    if (error.code === 'ECONNABORTED' || errStr.includes('timeout')) reason = 'Request timeout. Please try again.';
                    else if (error.response?.status === 429) reason = 'Rate limit exceeded. Please try again in a few seconds.';
                    else if (error.response?.status === 403) reason = 'Access denied.';
                    else if (error.response?.status === 404) reason = 'Domain not supported by bypass service.';
                    else if (error.response?.status === 500) reason = 'Server error. Please try again.';
                    else if (errStr.includes('no result')) reason = 'No result from API. Try again.';
                    failMsg = this.getText(chatId, 'bypass_failed', timeTaken, reason);
                }

                let sentFailMsg;
                try {
                    sentFailMsg = await this.bot.sendMessage(chatId, failMsg, {
                        parse_mode: 'HTML',
                        reply_to_message_id: originalMessageId,
                        ...(failMarkupToUse ? { reply_markup: failMarkupToUse } : {})
                    });
                } catch { sentFailMsg = null; }

                // Auto-delete both msgs simultaneously
                setTimeout(async () => {
                    await Promise.all([
                        originalMessageId ? this.bot.deleteMessage(chatId, originalMessageId).catch(() => {}) : Promise.resolve(),
                        sentFailMsg ? this.bot.deleteMessage(chatId, sentFailMsg.message_id).catch(() => {}) : Promise.resolve()
                    ]);
                }, this.failedAutoDeleteDelay);

                if (false) { // dead code placeholder
                    const errorMsg = await this.bot.sendMessage(chatId, '', {
                        parse_mode: 'HTML',
                        reply_to_message_id: originalMessageId
                    });
                    
                    // Auto delete failed bypass messages after 3 seconds
                    setTimeout(async () => {
                        try {
                            await this.bot.deleteMessage(chatId, originalMessageId);
                            await this.bot.deleteMessage(chatId, errorMsg.message_id);
                        } catch (deleteError) {
                            if (!deleteError.message.includes('message to delete not found')) {
                                console.error('Error deleting messages:', deleteError.message);
                            }
                        }
                    }, this.failedAutoDeleteDelay);
                }
            }
        } catch (error) {
            console.error('Error in processBypassRequest:', error);
            // Send generic error message
            await this.bot.sendMessage(chatId, "❌ Error processing your request. Please try again.", {
                reply_to_message_id: originalMessageId
            });
        }
    }

    async showLanguageOptions(chatId, messageId) {
        const languageMessage = this.getText(chatId, 'language_options');
        const replyMarkup = {
            inline_keyboard: [[
                { text: "English", callback_data: "lang_en", icon_custom_emoji_id: "5339498171246588311", style: "success" },
                { text: "မြန်မာ",   callback_data: "lang_mm", icon_custom_emoji_id: "5188162778073935826", style: "danger"  }
            ],
            [
                { text: this.getText(chatId, 'button_back'), callback_data: "back_menu", icon_custom_emoji_id: "5258084656674250503", style: "primary" }
            ]]
        };
        // No messageId → send new message
        if (!messageId) {
            const sent = await this.bot.sendMessage(chatId, languageMessage, { parse_mode: 'HTML', reply_markup: replyMarkup });
            this.messageTypes[sent.message_id] = 'text';
            return;
        }
        // Has messageId → try caption edit, then text edit
        try {
            await this.bot.editMessageCaption(languageMessage, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: replyMarkup });
            return;
        } catch {}
        try {
            await this.bot.editMessageText(languageMessage, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: replyMarkup });
        } catch (e) { console.error('Language options error:', e.message); }
    }

    async setLanguage(chatId, lang, messageId) {
        this.userLanguages[chatId] = lang;
        const responseMessage = this.getText(chatId, 'language_set');
        const replyMarkup = { inline_keyboard: [[
            { text: this.getText(chatId, 'button_back'), callback_data: "back_menu", icon_custom_emoji_id: "5258084656674250503", style: "success" }
        ]] };
        // Photo message → editCaption, text message → editText
        try {
            await this.bot.editMessageCaption(responseMessage, {
                chat_id: chatId, message_id: messageId,
                parse_mode: 'HTML', reply_markup: replyMarkup
            });
            this.messageTypes[messageId] = 'photo';
            return;
        } catch {}
        try {
            await this.bot.editMessageText(responseMessage, {
                chat_id: chatId, message_id: messageId,
                parse_mode: 'HTML', reply_markup: replyMarkup
            });
            this.messageTypes[messageId] = 'text';
        } catch (e) { console.error('Set language error:', e.message); }
    }

    async showSupportedDomainsNew(chatId) {
        const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
        const backBtn = [{ text: this.getText(chatId, 'button_back'), callback_data: "back_menu", icon_custom_emoji_id: "5258084656674250503", style: "success" }];
        const sent = await this.bot.sendMessage(chatId,
            `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> ${isEn ? 'Loading...' : 'ဖွင့်နေပါတယ်...'}`,
            { parse_mode: 'HTML' }
        );
        // Reuse existing logic via fake messageId
        await this.showSupportedDomains(chatId, sent.message_id);
    }

    async showSupportedDomains(chatId, messageId) {
        const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
        const backBtn = [{ text: this.getText(chatId, 'button_back'), callback_data: "back_menu", icon_custom_emoji_id: "5258084656674250503", style: "success" }];

        const doEditOrCaption = async (text) => {
            const opts = { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: { inline_keyboard: [backBtn] } };
            try { await this.bot.editMessageCaption(text, opts); return; } catch {}
            try { await this.bot.editMessageText(text, opts); } catch (e) {
                if (!e.message?.includes('not modified')) console.error('Edit domains error:', e.message);
            }
        };

        try {
            // Fetch from public izen.lol/v1/supported (auto-updates)
            const response = await axios.get('https://api.izen.lol/v1/supported', {
                headers: { 'x-api-key': this.apiKey, 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });
            const raw = response.data;

            let entries = [];
            // Handle both array and {result:[]} shapes
            const list = Array.isArray(raw) ? raw : (raw?.result || raw?.data || []);

            for (const item of list) {
                const name    = item.name    || item.title || item.script || '';
                const domains = item.domains || (item.domain ? [item.domain] : []);
                const url     = item.url     || item.link  || (domains[0] ? `https://${domains[0]}` : null);
                if (name || url) {
                    entries.push({ name: name || domains[0] || 'Unknown', url });
                } else if (Array.isArray(domains)) {
                    for (const d of domains) entries.push({ name: d, url: `https://${d}` });
                }
            }

            // Deduplicate by url
            const seen = new Set();
            entries = entries.filter(e => {
                const key = e.url || e.name;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            const total = entries.length;
            const display = entries.slice(0, 80);

            let msg = `<tg-emoji emoji-id="6269163801178804220">✅</tg-emoji> <b>${isEn ? 'Supported Sites' : 'ထောက်ပံ့သောဆိုဒ်များ'}</b>\n`;
            msg += `<tg-emoji emoji-id="6053323501073341449">📊</tg-emoji> <b>Total: ${total}</b>\n\n`;

            for (const entry of display) {
                if (entry.url) {
                    msg += `• <a href="${entry.url}">${entry.name}</a>\n`;
                } else {
                    msg += `• ${entry.name}\n`;
                }
            }
            if (total > 80) msg += `\n<i>... and ${total - 80} more</i>`;

            await doEditOrCaption(msg);

        } catch (error) {
            console.error('Supported domains API error:', error.message);
            await doEditOrCaption(this.getFallbackDomainsMessage());
        }
    }

    getFallbackDomainsMessage() {
        let domainsMessage = `<b><tg-emoji emoji-id="6269163801178804220">✅</tg-emoji> Supported Link List</b>\n\n`;
        
        // Show all domains with bullet points
        const uniqueDomains = [...new Set(this.supportedDomains)].sort();
        
        uniqueDomains.forEach((domain, index) => {
            domainsMessage += `• ${domain}\n`;
        });
        
        domainsMessage += `\n<tg-emoji emoji-id="6269163801178804220">✅</tg-emoji> <b>Total: ${uniqueDomains.length} Supported Links</b>`;
        
        return domainsMessage;
    }

    // ==================== SUPPORTED DOMAINS UPDATE ====================
    
    async updateSupportedDomainsFromAPI() {
        try {
            const response = await axios.get(`${this.apiBase}/supported`, {
                headers: {
                    'x-api-key': this.apiKey
                },
                timeout: 10000
            });

            if (response.data && response.data.result && Array.isArray(response.data.result)) {
                const newDomains = [];
                // API ရဲ့ structure အရ domain တွေကို စုစည်းမယ်
                for (const item of response.data.result) {
                    if (item.domains && Array.isArray(item.domains)) {
                        newDomains.push(...item.domains);
                    }
                }
                
                if (newDomains.length > 0) {
                    // ထပ်တူကျတာတွေကို ဖယ်ရှားပြီး စီမယ်
                    this.supportedDomains = [...new Set(newDomains)].sort();
                    console.log(`✅ Supported domains updated from API. Total: ${this.supportedDomains.length}`);
                } else {
                    console.log('⚠️ API returned empty domain list.');
                }
            }
        } catch (error) {
            console.error('Error updating supported domains from API:', error.message);
        }
    }

    // ==================== UTILITY METHODS ====================

    getText(chatId, key, ...params) {
        const lang = this.userLanguages[chatId] || 'en';
        
        const texts = {
            en: {
                welcome: `<tg-emoji emoji-id="5368324170671202286">🔔</tg-emoji> 𝖧𝖾𝗅𝗅𝗈 ${params[2] || 'User'} 𝖶𝖾𝗅𝖼𝗈𝗆𝖾 𝖳𝗈 𝖱𝖪𝖤 𝖪𝖾𝗒 𝖡𝗒𝗉𝖺𝗌𝗌 \n\n` +
                    `• 𝖧𝗈𝗐 𝖢𝖺𝗇 𝖨 𝖧𝖾𝗅𝗉 𝖸𝗈𝗎 𝖳𝗈𝖽𝖺𝗒?\n\n` +
                    `• 𝖴𝗌𝖾𝗋 𝖨𝖣: <code>${params[0] || ''}</code>\n` +
                    `• 𝖴𝗌𝖾𝗋𝗇𝖺𝗆𝖾: @${params[1] || ''}\n\n` +
                    `<tg-emoji emoji-id="5339141594471742013">⚙️</tg-emoji> 𝖲𝗎𝗉𝗉𝗈𝗋𝗍𝖾𝖽 𝖯𝗅𝖺𝗍𝖿𝗈𝗋𝗆𝗌:\n` +
                    `• 𝖣𝖾𝗅𝗍𝖺\n` +
                    `• 𝖫𝗂𝗇𝗄𝗏𝖾𝗋𝗍𝗂𝗌𝖾\n` +
                    `• 𝖲𝖼𝗋𝗂𝗉𝗍 𝖪𝖾𝗒\n` +
                    `• 𝖠𝗇𝖽 𝖬𝗈𝗋𝖾!....\n\n` +
                    `<tg-emoji emoji-id="6223999093325172045">➡️</tg-emoji> 𝖢𝗈𝗇𝗍𝗋𝗈𝗅 𝖯𝖺𝗇𝖾𝗅`,
                
                language_options: `<b><tg-emoji emoji-id="6339280615459789282">🌐</tg-emoji> Choose your language:</b>`,
                
                language_set: `<b><tg-emoji emoji-id="6327717992268301521">✅</tg-emoji> Language has been set to English!</b>`,
                
                processing: `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> Processing your request...`,
                
                bypass_success: `<tg-emoji emoji-id="6269163801178804220">✅</tg-emoji> <b>Bypass Success [${params[0] || ''}]</b>\n` +
                    `<tg-emoji emoji-id="5276412364458059956">🕓</tg-emoji> <b>Time taken:</b> ${params[1] || ''}s\n` +
                    `<b>Result:</b> <code>${params[2] || ''}</code>`,
                
                bypass_failed: `<tg-emoji emoji-id="6269163801178804220">❌</tg-emoji> <b>Bypass Failed</b>\n\n` +
                    `<tg-emoji emoji-id="5276412364458059956">🕓</tg-emoji> <b>Time taken:</b> ${params[0] || ''}s\n\n` + (params[1] || ''),
                
                expired_session: `<tg-emoji emoji-id="6269316311172518259">😭</tg-emoji> <b>Bypass Failed:</b> This session has expired, please get a new link from the application.`,
                
                broadcast_welcome: `<b>📢 Advanced Broadcast System</b>\n\n` +
                    `Create your broadcast message with buttons, photos, videos, or documents.\n\n` +
                    `Choose the type of broadcast you want to send:`,
                
                broadcast_cancelled: `❌ Broadcast cancelled.`,
                
                join_required: `<tg-emoji emoji-id="6300742299114541958">📢</tg-emoji> <b>Please join these Channels to use the Bot:</b>`,
                
                join_check: `<tg-emoji emoji-id="6185908127888575253">🔔</tg-emoji> Please join all channels, then press "I've Joined" Button Click`,
                
                join_success: `🎉 Great! You've joined all required channels. Now you can use the bot.`,
                
                join_missing: `❌ You still need to join ${params[0] || '0'} channel(s). Please join all channels and press "Refresh Status"`,
                
                unsupported_domain: `❌ <b>Unsupported Domain</b>\n\nThis domain is not supported by our bypass service.\n\nPlease check our supported link list by clicking "✅ Supported" button.`,
                
                button_language: `Language`,
                button_support: `Supported`,
                button_miniapp: `RKE Key Bypass`,
                button_back: `« Back to Menu`,
                button_join: `🔗 Join Channel`,
                button_joined: `✅ I've Joined`,
                button_refresh: `🔄 Refresh Status`,
                button_copy: `Copy Result`,
                button_cancel: `Cancel`,
                
                // Supporting section
                supporting_title: "Your support is valuable to everyone",
                supporting_message: "We are trying our best to make this bot free for everyone to use.\n\nIf we receive support from you for server costs, it will help us a lot and also help other users by not stopping the services.\n\nThis is voluntary help, so if you can't, don't worry at all.\n\nYou can continue to use all services for free as before.",
                supporting_payment: "PAYMENT",
                supporting_qr: "QR PAYMENT",
                supporting_copy_number: "Copy Number",
                supporting_send_screenshot: "Send Screenshot to Admin",
                supporting_back: "Back",
                payment_methods: "Payment Methods: ⭐",
                payment_wave: "📱Wave - 09788163900",
                payment_name: "😐 Name - [ T T ]",
                payment_instruction: "After transferring money, you can send a screenshot.",
                qr_payment_title: "QR PAYMENT",
                send_screenshot_instruction: "📸 Please send your payment screenshot (photo only):",
                payment_confirmation: "✅ Thank you for your payment! Admin has been notified and will verify your payment soon.",
                
                // Feedback section - updated with premium emoji at the beginning
                feedback_instruction: `<tg-emoji emoji-id="5870844977914842593"></tg-emoji> 📋 <b>Send Your Feedback</b>\n\nPlease send your feedback message (text, photo, video, or document):`,
                feedback_thankyou: "✅ <b>Thank you for your feedback!</b>\n\nYour message has been sent to the administrators. They will review it and respond if needed.",
            },
            
            mm: {
                welcome: `<tg-emoji emoji-id="5368324170671202286">🔔</tg-emoji> မင်္ဂလာပါ ${params[2] || 'User'} RKE Key Bypass မှ ကြိုဆိုပါတယ် \n\n` +
                    `• ဘာအကူအညီလိုအပ်ပါသလဲ?\n\n` +
                    `• အသုံးပြုသူ ID: <code>${params[0] || ''}</code>\n` +
                    `• အသုံးပြုသူအမည်: @${params[1] || ''}\n\n` +
                    `<tg-emoji emoji-id="5339141594471742013">⚙️</tg-emoji> ထောက်ပံ့သော Platform များ:\n` +
                    `• Delta\n` +
                    `• Linkvertise\n` +
                    `• Script Key\n` +
                    `• နောက်ထပ်များ!....\n\n` +
                    `<tg-emoji emoji-id="6223999093325172045">➡️</tg-emoji> Control Panel`,
                
                language_options: `<b><tg-emoji emoji-id="6339280615459789282">🌐</tg-emoji> ဘာသာစကားရွေးချယ်ပါ:</b>`,
                
                language_set: `<b><tg-emoji emoji-id="6327717992268301521">✅</tg-emoji> ဘာသာစကားကို မြန်မာသို့ ပြောင်းလိုက်ပါပြီ!</b>`,
                
                processing: `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> သင့်တောင်းဆိုချက်ကို လုပ်ဆောင်နေပါတယ်...`,
                
                bypass_success: `<tg-emoji emoji-id="6269163801178804220">✅</tg-emoji> <b>Bypass အောင်မြင်ပါပြီ [${params[0] || ''}]</b>\n` +
                    `<tg-emoji emoji-id="5276412364458059956">🕓</tg-emoji> <b>ကြာချိန်:</b> ${params[1] || ''}s\n` +
                    `<b>ရလဒ်:</b> <code>${params[2] || ''}</code>`,
                
                bypass_failed: `<tg-emoji emoji-id="6269163801178804220">❌</tg-emoji> <b>Bypass မအောင်မြင်ပါ</b>\n\n` +
                    `<tg-emoji emoji-id="5276412364458059956">🕓</tg-emoji> <b>ကြာချိန်:</b> ${params[0] || ''}s\n\n` + (params[1] || ''),
                
                expired_session: `<tg-emoji emoji-id="6269316311172518259">😭</tg-emoji> <b>Bypass မအောင်မြင်ပါ:</b> ဤ session သက်တမ်းကုန်သွားပါပြီ၊ application မှ link အသစ်တစ်ခုရယူပါ။`,
                
                broadcast_welcome: `<b>📢 အဆင့်မြင့် သတင်းပို့စနစ်</b>\n\n` +
                    `ခလုတ်များ၊ ဓာတ်ပုံများ၊ ဗီဒီယိုများ သို့မဟုတ် ဖိုင်များပါဝင်သော သင့်ရဲ့ သတင်းပို့ချက်ကို ဖန်တီးပါ။\n\n` +
                    `သင် ပို့လိုသော သတင်းပို့ချက် အမျိုးအစားကို ရွေးချယ်ပါ:`,
                
                broadcast_cancelled: `❌ သတင်းပို့ခြင်း ပယ်ဖျက်လိုက်ပါပြီ။`,
                
                join_required: `<tg-emoji emoji-id="6300742299114541958">📢</tg-emoji> <b>ကျေးဇူးပြု၍ ဤချန်နယ်များကို ဝင်ရောက်ပါ:</b>\n\n`,
                
                join_check: `<tg-emoji emoji-id="6185908127888575253">🔔</tg-emoji> ကျေးဇူးပြု၍ ချန်နယ်အားလုံးကို ဝင်ရောက်ပါ၊ ပြီးလျှင် "ဝင်ပြီးပါပြီ" ခလုတ်ကို နှိပ်ပါ။`,
                
                join_success: `🎉 ကျေးဇူးတင်ပါတယ်! သင်သည် လိုအပ်သော ချန်နယ်အားလုံးကို ဝင်ရောက်ပြီးပါပြီ။ ယခု ဘော့ကို အသုံးပြုနိုင်ပါပြီ။`,
                
                join_missing: `❌ သင်သည် ${params[0] || '0'} ချန်နယ်များ ဝင်ရောက်ရန် လိုအပ်နေပါသေးတယ်။ ကျေးဇူးပြု၍ ချန်နယ်အားလုံးကို ဝင်ရောက်ပြီး "အခြေအနေ ပြန်စစ်ပါ" ခလုတ်ကို နှိပ်ပါ။`,
                
                unsupported_domain: `❌ <b>မထောက်ပံ့ထားသော Domain</b>\n\nဤ domain ကို ကျွန်ုပ်တို့၏ bypass service မှ ထောက်ပံ့မထားပါ။\n\nကျေးဇူးပြု၍ "✅ ထောက်ပံ့သည့်လင့်များ" ခလုတ်ကိုနှိပ်၍ ထောက်ပံ့ထားသော link စာရင်းကို စစ်ဆေးပါ။`,
                
                button_language: `ဘာသာစကား`,
                button_support: `ထောက်ပံ့သည့်လင့်များ`,
                button_miniapp: `RKE Key Bypass`,
                button_back: `« မူလမီနူးသို့`,
                button_join: `🔗 Channel ကို Join ပါ`,
                button_joined: `✅ ဝင်ပြီးပါပြီ`,
                button_refresh: `🔄 အခြေအနေ ပြန်စစ်ပါ`,
                button_copy: `ရလဒ်ကို Copy လုပ်ပါ`,
                button_cancel: `ပယ်ဖျက်ရန်`,
                
                // Supporting section
                supporting_title: "လူကြီးမင်းရဲ့ ပံ့ပိုးမှုက အများအတွက် အကျိုးရှိစေပါတယ်",
                supporting_message: "ဒီ Bot လေးကို လူတိုင်း အခမဲ့ အသုံးပြုနိုင်ဖို့ ကျွန်တော်တို့ အစွမ်းကုန် ကြိုးစားနေပါတယ်ခင်ဗျာ။\n\nServer ကုန်ကျစရိတ်တွေအတွက် လူကြီးမင်းတို့ဆီက ဝိုင်းဝန်းပံ့ပိုးမှု ရရှိမယ်ဆိုရင် ကျွန်တော်တို့အတွက် အများကြီး ခရီးရောက်စေမှာဖြစ်သလို၊ အခြားအသုံးပြုသူတွေအတွက်လည်း ဝန်ဆောင်မှုတွေ မရပ်တန့်သွားအောင် ကူညီပေးရာ ရောက်ပါတယ်\n\nဒါဟာ စေတနာအလျောက် ကူညီခြင်းသာဖြစ်လို့ အဆင်မပြေခဲ့ရင်လည်း လုံးဝ စိတ်မရှိပါနဲ့ခင်ဗျာ။\n\nလူကြီးမင်းအနေနဲ့ ဝန်ဆောင်မှုအားလုံးကို အရင်အတိုင်း အခမဲ့အစဉ်အမြဲ ဆက်လက်အသုံးပြုနိုင်ပါတယ်",
                supporting_payment: "PAYMENT",
                supporting_qr: "QR PAYMENT",
                supporting_copy_number: "နံပါတ်ကို Copy လုပ်ရန်",
                supporting_send_screenshot: "Admin ထံ Screenshot ပို့ရန်",
                supporting_back: "နောက်သို့",
                payment_methods: "Payment Methods: ⭐",
                payment_wave: "📱Wave - 09788163900",
                payment_name: "😐 Name - [ T T ]",
                payment_instruction: "ငွေလွှဲပြီးပါက Screenshot ပေးပို့နိုင်ပါသည်။",
                qr_payment_title: "QR PAYMENT",
                send_screenshot_instruction: "📸 ကျေးဇူးပြု၍ သင့်ငွေလွှဲ Screenshot ကို ပို့ပါ (ဓာတ်ပုံသာလျှင်):",
                payment_confirmation: "✅ ကျေးဇူးတင်ပါတယ်! Admin ကိုအကြောင်းကြားပြီးပါပြီ။ သင့်ငွေလွှဲမှုကို အတည်ပြုပေးပါမည်။",
                
                // Feedback section - updated with premium emoji at the beginning
                feedback_instruction: `<tg-emoji emoji-id="5870844977914842593"></tg-emoji> 📋 <b>သင့်အကြံပြုချက်ကို ပို့ပါ</b>\n\nကျေးဇူးပြု၍ သင့်အကြံပြုချက်ကို ပို့ပါ (စာသား၊ ဓာတ်ပုံ၊ ဗီဒီယို သို့မဟုတ် ဖိုင်):`,
                feedback_thankyou: "✅ <b>ကျေးဇူးတင်ပါတယ်!</b>\n\nသင့်အကြံပြုချက်ကို admin များထံ ပို့ပြီးပါပြီ။ သူတို့ကြည့်ရှုပြီး လိုအပ်ပါက ပြန်လည်ဆက်သွယ်ပေးပါမည်။",
            }
        };
        
        return texts[lang][key] || texts['en'][key] || '';
    }

    // ==================== SONG FETCHER (multi-source) ====================

    // ==================== MUSIC METHODS (SmartDlBot style) ====================

    // Parse JioSaavn track object → standard result
    _parseSaavnTrack(track, fallbackName) {
        if (!track) return null;
        const dlUrls = track.downloadUrl || track.download_url || [];
        const best = dlUrls.find(u => u.quality === '320kbps') ||
                     dlUrls.find(u => u.quality === '160kbps') ||
                     dlUrls.find(u => u.quality === '128kbps') ||
                     dlUrls.slice(-1)[0];
        const audioUrl = best?.link || best?.url;
        if (!audioUrl) return null;
        const dur = parseInt(track.duration) || 0;
        const durationStr = dur > 0 ? `${Math.floor(dur/60)}:${String(dur%60).padStart(2,'0')}` : '';
        const artist = track.primaryArtists ||
                       track.more_info?.primary_artists ||
                       track.artists?.primary?.map(a => a.name).join(', ') ||
                       'Unknown';
        const rawImg = track.image?.[2]?.url || track.image?.[1]?.url || track.image?.[0]?.url || null;
        return {
            audioUrl,
            title:  track.name  || track.title || fallbackName || 'Unknown',
            artist,
            album:  track.album?.name || track.more_info?.album || '',
            durationStr,
            imageUrl: rawImg ? rawImg.replace('150x150','500x500').replace('50x50','500x500') : null,
            source: 'jiosaavn'
        };
    }

    // Main JioSaavn search (multi-mirror)
    async fetchSong(songName) {
        const q = encodeURIComponent(songName);
        const MIRRORS = [
            `https://saavn.dev/api/search/songs?query=${q}&limit=10`,
            `https://jiosaavn-api-five.vercel.app/api/search/songs?query=${q}&page=1&limit=10`,
            `https://jiosaavn-api-sigma.vercel.app/api/search/songs?query=${q}&page=1&limit=10`,
            `https://saavn-api-sigma.vercel.app/api/search/songs?query=${q}&limit=10`,
            `https://jiosaavn-api-2.vercel.app/api/search/songs?query=${q}&page=1&limit=10`,
            `https://saavn-api-xi.vercel.app/api/search/songs?query=${q}&limit=10`,
        ];
        for (const url of MIRRORS) {
            try {
                const r = await axios.get(url, {
                    timeout: 12000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                const results = r.data?.data?.results || r.data?.results || r.data?.data || [];
                const arr = Array.isArray(results) ? results : (results ? [results] : []);
                for (const track of arr) {
                    const parsed = this._parseSaavnTrack(track, songName);
                    if (parsed) {
                        console.log(`[Song] Found via ${url.split('/')[2]}`);
                        return parsed;
                    }
                }
            } catch (e) {
                console.error(`[Song] Mirror failed ${url.split('/')[2]}:`, e.message);
            }
        }
        // Fallback: try iTunes search for metadata + saavn for audio
        try {
            const itunes = await axios.get(`https://itunes.apple.com/search?term=${q}&media=music&limit=1`, { timeout: 8000 });
            const track = itunes.data?.results?.[0];
            if (track) {
                const mirrorName = `${track.artistName} ${track.trackName}`;
                const q2 = encodeURIComponent(mirrorName);
                const r2 = await axios.get(`https://saavn.dev/api/search/songs?query=${q2}&limit=5`, { timeout: 12000 });
                const results2 = r2.data?.data?.results || [];
                if (results2.length) {
                    const parsed = this._parseSaavnTrack(results2[0], mirrorName);
                    if (parsed) return parsed;
                }
            }
        } catch {}
        return null;
    }

    // Fetch Spotify track metadata (title/artist/image) without auth using odesli/noembed
    async resolveSpotifyTrack(spotifyUrl) {
        try {
            // Use odesli.co (songlink) to get metadata
            const r = await axios.get(
                `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(spotifyUrl)}&userCountry=US`,
                { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } }
            );
            const data = r.data;
            const entity = data?.entitiesByUniqueId?.[data?.entityUniqueId];
            if (!entity) return null;
            return {
                title: entity.title || '',
                artist: entity.artistName || '',
                imageUrl: entity.thumbnailUrl || null
            };
        } catch {
            // Fallback: scrape og tags from Spotify embed
            try {
                const trackId = spotifyUrl.match(/track\/([A-Za-z0-9]+)/)?.[1];
                if (!trackId) return null;
                const r2 = await axios.get(`https://embed.spotify.com/?uri=spotify:track:${trackId}`, {
                    timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                const titleMatch = r2.data.match(/<title>([^<]+)<\/title>/);
                const raw = titleMatch?.[1] || '';
                // "Song Title - Artist | Spotify" or "Song Title by Artist"
                const parts = raw.replace(' | Spotify','').split(' - ');
                return { title: parts[0]?.trim() || raw, artist: parts[1]?.trim() || '', imageUrl: null };
            } catch { return null; }
        }
    }

    // Fetch audio from YouTube via smartytdl.vercel.app
    async fetchYtAudio(ytUrl) {
        try {
            const r = await axios.get(
                `https://smartytdl.vercel.app/dl?url=${encodeURIComponent(ytUrl)}`,
                { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } }
            );
            const d = r.data;
            if (d?.error) return null;
            // Pick best audio format (m4a preferred)
            const medias = d?.medias || [];
            const audio = medias.find(m => m.type === 'audio') || medias.find(m => m.ext === 'm4a');
            if (!audio?.url) return null;
            const dur = audio.duration || 0;
            const durationStr = dur > 0 ? `${Math.floor(dur/60)}:${String(dur%60).padStart(2,'0')}` : '';
            return {
                audioUrl: audio.url,
                title: d.title || 'YouTube Audio',
                artist: d.author || '',
                album: '',
                durationStr,
                imageUrl: d.thumbnail || d.thumbnail_url || null,
                source: 'youtube'
            };
        } catch (e) {
            console.error('[YT Audio] smartytdl error:', e.message);
        }
        return null;
    }

    // Fetch VIDEO from YouTube via smartytdl.vercel.app
    async fetchYtVideo(ytUrl, quality) {
        const r = await axios.get(
            `https://smartytdl.vercel.app/dl?url=${encodeURIComponent(ytUrl)}`,
            { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        const d = r.data;
        if (d?.error || !d?.medias) throw new Error(d?.error || 'no medias');
        const videos = d.medias.filter(m => m.type === 'video').sort((a,b) => (b.bitrate||0)-(a.bitrate||0));
        // Pick quality: 720p preferred, else best
        const vid = videos.find(m => m.label?.includes('720')) || videos[0];
        if (!vid?.url) throw new Error('no video url');
        const dur = vid.duration || 0;
        return {
            videoUrl: vid.url,
            title: d.title || 'YouTube Video',
            author: d.author || '',
            thumbUrl: d.thumbnail || d.thumbnail_url || null,
            duration: dur,
            label: vid.label || vid.quality || 'video',
            source: 'youtube'
        };
    }

    // Search YouTube via smartytdl.vercel.app
    async searchYoutube(query) {
        const r = await axios.get(
            `https://smartytdl.vercel.app/search?q=${encodeURIComponent(query)}`,
            { timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        return r.data?.result || [];
    }

    // Send the final audio file to Telegram
    async sendMusicFile(chatId, replyMsgId, statusMsgId, result, isEn) {
        const { audioUrl, title, artist, album, durationStr, imageUrl } = result;
        const source = result.source === 'youtube' ? '▶️ YouTube Music' : '🎵 JioSaavn';

        const caption =
            `<tg-emoji emoji-id="5350618807943576963">🎵</tg-emoji> <b>${title}</b>\n` +
            (artist ? `<tg-emoji emoji-id="5368324170671202286">👤</tg-emoji> ${artist}\n` : '') +
            (album  ? `<tg-emoji emoji-id="5339141594471742013">💿</tg-emoji> ${album}\n`  : '') +
            (durationStr ? `<tg-emoji emoji-id="6053323501073341449">⏱</tg-emoji> ${durationStr}\n` : '') +
            `\n<i>${source} • via RKE Bypass Bot</i>`;

        // Download audio buffer
        const dlRes = await axios.get(audioUrl, {
            responseType: 'arraybuffer', timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.jiosaavn.com/' }
        });
        const tmpPath = path.join('/tmp', `song_${Date.now()}.mp3`);
        fs.writeFileSync(tmpPath, Buffer.from(dlRes.data));

        const sendOpts = {
            title, performer: artist,
            caption, parse_mode: 'HTML',
            reply_to_message_id: replyMsgId
        };

        // Album cover thumbnail
        if (imageUrl) {
            try {
                const tRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 8000 });
                const thumbPath = path.join('/tmp', `thumb_${Date.now()}.jpg`);
                fs.writeFileSync(thumbPath, Buffer.from(tRes.data));
                sendOpts.thumbnail = fs.createReadStream(thumbPath);
                await this.bot.sendAudio(chatId, fs.createReadStream(tmpPath), sendOpts);
                fs.unlinkSync(thumbPath);
            } catch {
                delete sendOpts.thumbnail;
                await this.bot.sendAudio(chatId, fs.createReadStream(tmpPath), sendOpts);
            }
        } else {
            await this.bot.sendAudio(chatId, fs.createReadStream(tmpPath), sendOpts);
        }

        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        await this.bot.deleteMessage(chatId, statusMsgId).catch(() => {});
    }

    // Helper: delete a message silently
    async _deleteMsg(chatId, messageId) {
        try { await this.bot.deleteMessage(chatId, messageId); } catch {}
    }

    showSongMenu(chatId) {
        const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
        const text = isEn
            ? `<tg-emoji emoji-id="5350618807943576963">🎵</tg-emoji> <b>Music Downloader</b>\n\n` +
              `Download full songs in <b>MP3 320kbps</b> with album art!\n\n` +
              `<tg-emoji emoji-id="5368324170671202286">🎙</tg-emoji> <b>Search by name:</b>\n` +
              `<code>/song Shape of You</code>\n` +
              `<code>/song Eminem Lose Yourself</code>\n\n` +
              `<tg-emoji emoji-id="5339141594471742013">🎧</tg-emoji> <b>Spotify link:</b>\n` +
              `<code>/song https://open.spotify.com/track/xxx</code>\n\n` +
              `<tg-emoji emoji-id="5258084656674250503">▶️</tg-emoji> <b>YouTube Music link:</b>\n` +
              `<code>/song https://music.youtube.com/watch?v=xxx</code>\n\n` +
              `<b>Sources:</b> JioSaavn (320kbps) • YouTube Music\n` +
              `<i>Note: Works best with English & Hindi songs</i>`
            : `<tg-emoji emoji-id="5350618807943576963">🎵</tg-emoji> <b>Music Downloader</b>\n\n` +
              `<b>MP3 320kbps</b> အရည်အသွေးနဲ့ Album cover ပါ ဒေါင်းရမည်!\n\n` +
              `<tg-emoji emoji-id="5368324170671202286">🎙</tg-emoji> <b>သီချင်းနာမည်နဲ့ ရှာပါ:</b>\n` +
              `<code>/song Shape of You</code>\n` +
              `<code>/song Eminem Lose Yourself</code>\n\n` +
              `<tg-emoji emoji-id="5339141594471742013">🎧</tg-emoji> <b>Spotify link:</b>\n` +
              `<code>/song https://open.spotify.com/track/xxx</code>\n\n` +
              `<tg-emoji emoji-id="5258084656674250503">▶️</tg-emoji> <b>YouTube Music link:</b>\n` +
              `<code>/song https://music.youtube.com/watch?v=xxx</code>\n\n` +
              `<b>Sources:</b> JioSaavn (320kbps) • YouTube Music\n` +
              `<i>မှတ်ချက်: English / Hindi သီချင်းများအတွက် အကောင်းဆုံး အလုပ်လုပ်သည်</i>`;

        return this.bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [
                [
                    { text: isEn ? '🔍 Search Tips' : '🔍 ရှာနည်း Tips', callback_data: 'song_tips', icon_custom_emoji_id: '5350618807943576963', style: 'primary' },
                    { text: isEn ? 'Back' : 'ပြန်', callback_data: 'back_menu', icon_custom_emoji_id: '5258084656674250503', style: 'danger' }
                ]
            ]}
        });
    }

    // ==================== CATBOX.MOE UPLOADER ====================

    showCatboxMenu(chatId) {
        const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
        const text = isEn
            ? `<tg-emoji emoji-id="5260450573768990626">➡️</tg-emoji> <b>Catbox File Uploader</b>\n\n` +
              `Upload any file and get a <b>permanent URL</b> — free, no login required!\n\n` +
              `<tg-emoji emoji-id="5350618807943576963">⚡</tg-emoji> <b>Supports:</b> Photo, Video, Document, Audio\n` +
              `<tg-emoji emoji-id="5339141594471742013">💾</tg-emoji> <b>Max size:</b> ~200MB per file\n` +
              `<tg-emoji emoji-id="5368324170671202286">🔗</tg-emoji> <b>URL format:</b> <code>https://files.catbox.moe/xxxxxx.ext</code>\n\n` +
              `Press <b>Upload File</b> then send your file!`
            : `<tg-emoji emoji-id="5260450573768990626">➡️</tg-emoji> <b>Catbox ဖိုင်တင်ရာ</b>\n\n` +
              `မည်သည့် ဖိုင်ကိုမဆို တင်ပြီး <b>Permanent URL</b> ရယူပါ — အခမဲ့!\n\n` +
              `<tg-emoji emoji-id="5350618807943576963">⚡</tg-emoji> <b>ပေးပို့နိုင်သည်:</b> Photo, Video, Document, Audio\n` +
              `<tg-emoji emoji-id="5339141594471742013">💾</tg-emoji> <b>Size:</b> ~200MB အထိ\n` +
              `<tg-emoji emoji-id="5368324170671202286">🔗</tg-emoji> <b>URL:</b> <code>https://files.catbox.moe/xxxxxx.ext</code>\n\n` +
              `<b>Upload File</b> ကို နှိပ်ပြီး ဖိုင် ပေးပို့ပါ!`;

        return this.bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [
                [
                    { text: isEn ? 'Upload File' : 'ဖိုင် Upload', callback_data: 'catbox_upload_start', icon_custom_emoji_id: '5260450573768990626', style: 'success' }
                ],
                [
                    { text: isEn ? 'Back' : 'ပြန်', callback_data: 'back_menu', icon_custom_emoji_id: '5258084656674250503', style: 'danger' }
                ]
            ]}
        });
    }

    async uploadToCatbox(fileId, fileName, chatId) {
        // Get file info from Telegram
        const fileInfo = await this.bot.getFile(fileId);
        const tgFileUrl = `https://api.telegram.org/file/bot${this.token}/${fileInfo.file_path}`;

        // Detect extension
        const ext = (fileInfo.file_path || '').split('.').pop() || 'bin';
        const cleanName = (fileName && fileName.includes('.')) ? fileName : `upload_${Date.now()}.${ext}`;

        // Download from Telegram as buffer
        const dlRes = await axios.get(tgFileUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const buffer = Buffer.from(dlRes.data);

        // Build multipart/form-data manually (no extra package needed)
        const boundary = `----FormBoundary${Date.now()}`;
        const CRLF = '\r\n';
        const parts = [];

        // reqtype field
        parts.push(Buffer.from(
            `--${boundary}${CRLF}Content-Disposition: form-data; name="reqtype"${CRLF}${CRLF}fileupload`
        ));
        // userhash field (empty = anonymous)
        parts.push(Buffer.from(
            `${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="userhash"${CRLF}${CRLF}`
        ));
        // file field
        parts.push(Buffer.from(
            `${CRLF}--${boundary}${CRLF}Content-Disposition: form-data; name="fileToUpload"; filename="${cleanName}"${CRLF}Content-Type: application/octet-stream${CRLF}${CRLF}`
        ));
        parts.push(buffer);
        parts.push(Buffer.from(`${CRLF}--${boundary}--`));

        const body = Buffer.concat(parts);

        const uploadRes = await axios.post('https://catbox.moe/user.php', body, {
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'User-Agent': 'Mozilla/5.0',
                'Content-Length': body.length
            },
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        const url = (uploadRes.data || '').toString().trim();
        if (!url || !url.startsWith('https://')) {
            throw new Error(`catbox returned: ${url || 'empty response'}`);
        }
        return { url, fileName: cleanName };
    }

    // ==================== SMART DL UI ====================

    showSmartDlMenu(chatId) {
        const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
        const text = isEn
            ? `<tg-emoji emoji-id="5341715473882955310">⚡</tg-emoji> <b>Smart Media Downloader</b>\n\n` +
              `Download videos & photos from popular platforms — <b>no watermark, free!</b>\n\n` +
              `<tg-emoji emoji-id="5350618807943576963">⚡</tg-emoji> <b>TikTok</b> — No watermark HD video\n` +
              `<tg-emoji emoji-id="5368324170671202286">📸</tg-emoji> <b>Instagram</b> — Reels, Posts, Stories\n` +
              `<tg-emoji emoji-id="5339141594471742013">🐦</tg-emoji> <b>Twitter / X</b> — Videos & GIFs\n` +
              `<tg-emoji emoji-id="5260450573768990626">📘</tg-emoji> <b>Facebook</b> — Public videos\n` +
              `<tg-emoji emoji-id="5258084656674250503">▶️</tg-emoji> <b>YouTube</b> — Videos up to 720p\n\n` +
              `<b>Usage:</b> <code>/dl &lt;link&gt;</code>\nExample: <code>/dl https://vm.tiktok.com/xxx</code>`
            : `<tg-emoji emoji-id="5341715473882955310">⚡</tg-emoji> <b>Smart Media Downloader</b>\n\n` +
              `လူကြိုက်များသော Platform များမှ ဗီဒီယို/ဓာတ်ပုံ ဒေါင်းလုဒ် — <b>watermark မပါ၊ အခမဲ့!</b>\n\n` +
              `<tg-emoji emoji-id="5350618807943576963">⚡</tg-emoji> <b>TikTok</b> — Watermark မပါ HD ဗီဒီယို\n` +
              `<tg-emoji emoji-id="5368324170671202286">📸</tg-emoji> <b>Instagram</b> — Reels, Posts, Stories\n` +
              `<tg-emoji emoji-id="5339141594471742013">🐦</tg-emoji> <b>Twitter / X</b> — ဗီဒီယို၊ GIF\n` +
              `<tg-emoji emoji-id="5260450573768990626">📘</tg-emoji> <b>Facebook</b> — Public ဗီဒီယိုများ\n` +
              `<tg-emoji emoji-id="5258084656674250503">▶️</tg-emoji> <b>YouTube</b> — 720p အထိ ဗီဒီယို\n\n` +
              `<b>အသုံးပြုနည်း:</b> <code>/dl &lt;link&gt;</code>\nဥပမာ: <code>/dl https://vm.tiktok.com/xxx</code>`;

        return this.bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [
                [
                    { text: 'TikTok',      callback_data: 'sdl_info_tiktok',    icon_custom_emoji_id: '5350618807943576963', style: 'danger'  },
                    { text: 'Instagram',   callback_data: 'sdl_info_instagram', icon_custom_emoji_id: '5368324170671202286', style: 'danger'  }
                ],
                [
                    { text: 'Twitter/X',  callback_data: 'sdl_info_twitter',   icon_custom_emoji_id: '5339141594471742013', style: 'primary' },
                    { text: 'Facebook',   callback_data: 'sdl_info_facebook',  icon_custom_emoji_id: '5260450573768990626', style: 'primary' }
                ],
                [
                    { text: 'YouTube',    callback_data: 'sdl_info_youtube',   icon_custom_emoji_id: '5258084656674250503', style: 'danger'  }
                ],
                [
                    { text: isEn ? 'How to Use' : 'အသုံးပြုနည်း', callback_data: 'smartdl_how', icon_custom_emoji_id: '5433811242135331842', style: 'success' }
                ],
                [
                    { text: isEn ? 'Back' : 'ပြန်', callback_data: 'back_menu', icon_custom_emoji_id: '5258084656674250503', style: 'danger' }
                ]
            ]}
        });
    }

    showSmartDlHowTo(chatId) {
        const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
        const text = isEn
            ? `<tg-emoji emoji-id="5433811242135331842">📖</tg-emoji> <b>How to Use Media Downloader</b>\n\n` +
              `<b>Step 1:</b> Copy the video/post link\n` +
              `<b>Step 2:</b> Type <code>/dl</code> then paste the link\n` +
              `<b>Step 3:</b> Wait for the bot to download\n\n` +
              `<b>📌 Examples:</b>\n` +
              `<code>/dl https://vm.tiktok.com/ZMxxxxxx/</code>\n` +
              `<code>/dl https://www.instagram.com/reel/xxx/</code>\n` +
              `<code>/dl https://x.com/user/status/xxx</code>\n` +
              `<code>/dl https://fb.watch/xxxxx/</code>\n` +
              `<code>/dl https://youtu.be/xxxxx</code>\n\n` +
              `<b>⚠️ Notes:</b>\n` +
              `• Only <b>public</b> content can be downloaded\n` +
              `• Private accounts, DMs, Stories (if private) won't work\n` +
              `• YouTube: max 720p quality\n` +
              `• TikTok: no watermark version`
            : `<tg-emoji emoji-id="5433811242135331842">📖</tg-emoji> <b>Media Downloader အသုံးပြုနည်း</b>\n\n` +
              `<b>အဆင့် ၁:</b> ဗီဒီယို/ပိုစ့် link ကို copy ယူပါ\n` +
              `<b>အဆင့် ၂:</b> <code>/dl</code> ရိုက်ပြီး link paste ပါ\n` +
              `<b>အဆင့် ၃:</b> Bot က download လုပ်ပေးသည်အထိ စောင့်ပါ\n\n` +
              `<b>📌 ဥပမာများ:</b>\n` +
              `<code>/dl https://vm.tiktok.com/ZMxxxxxx/</code>\n` +
              `<code>/dl https://www.instagram.com/reel/xxx/</code>\n` +
              `<code>/dl https://x.com/user/status/xxx</code>\n` +
              `<code>/dl https://fb.watch/xxxxx/</code>\n` +
              `<code>/dl https://youtu.be/xxxxx</code>\n\n` +
              `<b>⚠️ မှတ်ချက်:</b>\n` +
              `• <b>Public</b> content သာ download ရနိုင်သည်\n` +
              `• Private account, DM, Private Story မရပါ\n` +
              `• YouTube: 720p အထိ\n` +
              `• TikTok: Watermark မပါသော ဗားရှင်း`;

        return this.bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [
                [
                    { text: isEn ? 'Back to Downloader' : 'Downloader ကိုပြန်', callback_data: 'smartdl_menu', icon_custom_emoji_id: '5341715473882955310', style: 'success' }
                ]
            ]}
        });
    }

    // ==================== SMART DL BOT (Media Downloader) ====================

    detectPlatform(url) {
        const u = url.toLowerCase();
        if (u.includes('tiktok.com') || u.includes('vm.tiktok.com') || u.includes('vt.tiktok.com'))
            return { type: 'tiktok', name: 'TikTok', emoji: '🎵' };
        if (u.includes('instagram.com') || u.includes('instagr.am'))
            return { type: 'instagram', name: 'Instagram', emoji: '📸' };
        if (u.includes('twitter.com') || u.includes('x.com') || u.includes('t.co'))
            return { type: 'twitter', name: 'Twitter / X', emoji: '🐦' };
        if (u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.com'))
            return { type: 'facebook', name: 'Facebook', emoji: '📘' };
        if (u.includes('youtube.com') || u.includes('youtu.be'))
            return { type: 'youtube', name: 'YouTube', emoji: '▶️' };
        return null;
    }

    async downloadMedia(url, type) {
        switch (type) {
            case 'tiktok':    return await this.dlTikTok(url);
            case 'instagram': return await this.dlInstagram(url);
            case 'twitter':   return await this.dlTwitter(url);
            case 'facebook':  return await this.dlFacebook(url);
            case 'youtube':   return await this.dlYoutube(url);
            default:          return null;
        }
    }

    async dlTikTok(url) {
        // tikwm.com - free, no watermark
        const r = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({ url, hd: '1' }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
            timeout: 15000
        });
        const d = r.data?.data;
        if (!d) throw new Error('download_failed');
        return {
            type: 'video',
            videoUrl: d.hdplay || d.play,
            thumbUrl: d.cover,
            title: d.title || 'TikTok Video',
            author: d.author?.nickname || '',
            duration: d.duration || 0,
            likes: d.digg_count,
            views: d.play_count,
            platform: 'tiktok'
        };
    }

    async dlInstagram(url) {
        // Use multiple Instagram API mirrors
        const apis = [
            async () => {
                const r = await axios.get(`https://instagram-downloader-api.vercel.app/api/download?url=${encodeURIComponent(url)}`, { timeout: 12000 });
                const d = r.data;
                if (!d?.url) throw new Error('no url');
                return { type: d.type === 'GraphImage' ? 'photo' : 'video', videoUrl: d.url, thumbUrl: d.thumbnail, title: d.caption || 'Instagram Post', author: d.username || '', platform: 'instagram' };
            },
            async () => {
                const r = await axios.post('https://v3.igdownloader.app/api/ajaxSearch', new URLSearchParams({ recaptchaToken: '', q: url, t: 'media', lang: 'en' }), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' },
                    timeout: 12000
                });
                const html = r.data?.data || '';
                const videoMatch = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
                const imgMatch = html.match(/href="(https:\/\/[^"]+\.jpg[^"]*)"/);
                const mediaUrl = videoMatch?.[1] || imgMatch?.[1];
                if (!mediaUrl) throw new Error('no url');
                return { type: videoMatch ? 'video' : 'photo', videoUrl: mediaUrl, title: 'Instagram Post', author: '', platform: 'instagram' };
            }
        ];
        for (const api of apis) {
            try { const res = await api(); if (res) return res; } catch {}
        }
        throw new Error('download_failed');
    }

    async dlTwitter(url) {
        const apis = [
            // API 1: twittervideodownloader
            async () => {
                const r = await axios.post('https://twittervideodownloader.com/api/request-video',
                    `tweet=${encodeURIComponent(url)}`,
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://twittervideodownloader.com/' }, timeout: 15000 }
                );
                const links = r.data?.links || [];
                const best = links.find(l => l.type === 'video' && l.quality?.includes('hd')) || links.find(l => l.type === 'video') || links[0];
                if (!best?.src) throw new Error('no url');
                return { type: 'video', videoUrl: best.src, title: 'Twitter / X Video', author: '', platform: 'twitter' };
            },
            // API 2: twitsave scrape
            async () => {
                const r = await axios.get(`https://twitsave.com/info?url=${encodeURIComponent(url)}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 12000
                });
                const match = r.data?.match(/href="(https:\/\/video\.twimg\.com[^"]+)"/);
                if (!match) throw new Error('no url');
                return { type: 'video', videoUrl: match[1], title: 'Twitter / X Video', author: '', platform: 'twitter' };
            },
        ];
        for (const api of apis) {
            try { const res = await api(); if (res?.videoUrl) return res; } catch (e) { console.error('[Twitter]', e.message); }
        }
        throw new Error('download_failed');
    }

    async dlFacebook(url) {
        const apis = [
            async () => {
                const r = await axios.post('https://snapsave.app/action.php',
                    new URLSearchParams({ url }),
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://snapsave.app/' }, timeout: 15000 }
                );
                const html = r.data || '';
                const hdMatch = html.match(/href="(https?:\/\/[^"]+(?:video|mp4)[^"]*)"[^>]*>HD/i);
                const sdMatch = html.match(/href="(https?:\/\/[^"]+(?:video|mp4)[^"]*)"/);
                const videoUrl = (hdMatch?.[1] || sdMatch?.[1] || '').replace(/&amp;/g, '&');
                if (!videoUrl) throw new Error('no url');
                return { type: 'video', videoUrl, title: 'Facebook Video', author: '', platform: 'facebook' };
            },
            async () => {
                const r = await axios.post('https://getfvid.com/downloader',
                    new URLSearchParams({ url, quality: 'hd' }),
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://getfvid.com/' }, timeout: 15000 }
                );
                const html = r.data || '';
                const match = html.match(/href="(https?:\/\/[^"]+(?:\.mp4|video)[^"]*)"/);
                const videoUrl = match?.[1]?.replace(/&amp;/g, '&');
                if (!videoUrl) throw new Error('no url');
                return { type: 'video', videoUrl, title: 'Facebook Video', author: '', platform: 'facebook' };
            },
            async () => {
                const r = await axios.get(`https://fb.watch.download/?url=${encodeURIComponent(url)}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 12000
                });
                const d = r.data;
                const videoUrl = d?.hd || d?.sd || d?.url;
                if (!videoUrl) throw new Error('no url');
                return { type: 'video', videoUrl, title: d?.title || 'Facebook Video', author: '', platform: 'facebook' };
            }
        ];
        for (const api of apis) {
            try { const res = await api(); if (res?.videoUrl) return res; } catch (e) { console.error('[FB]', e.message); }
        }
        throw new Error('download_failed');
    }

    async dlYoutube(url) {
        const apis = [
            async () => {
                const r = await axios.get(`https://yt-api.p.rapidapi.com/dl?id=${encodeURIComponent(url)}`, {
                    headers: { 'X-RapidAPI-Key': 'sign_up_for_key', 'User-Agent': 'Mozilla/5.0' }, timeout: 20000
                });
                if (!r.data?.url) throw new Error('no url');
                return { type: 'video', videoUrl: r.data.url, title: r.data.title || 'YouTube', author: '', platform: 'youtube' };
            },
            async () => {
                const r = await axios.get(`https://ytstream-download-youtube-videos.p.rapidapi.com/dl?id=${url}`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000
                });
                const formats = r.data?.adaptiveFormats || r.data?.formats || [];
                const vid = formats.find(f => f.mimeType?.includes('video/mp4') && f.qualityLabel?.includes('720')) || formats.find(f => f.mimeType?.includes('video/mp4'));
                if (!vid?.url) throw new Error('no url');
                return { type: 'video', videoUrl: vid.url, title: r.data?.title || 'YouTube', author: r.data?.author || '', platform: 'youtube' };
            },
            async () => {
                const r = await axios.get(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, { timeout: 8000 });
                const title = r.data?.title || 'YouTube Video';
                const author = r.data?.author_name || '';
                const thumb = r.data?.thumbnail_url || null;
                // Use cobalt for actual download
                const r2 = await axios.post('https://api.cobalt.tools/api/json', {
                    url, vQuality: '720', isAudioOnly: false, disableMetadata: false
                }, { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 });
                const videoUrl = r2.data?.url;
                if (!videoUrl) throw new Error('no url');
                return { type: 'video', videoUrl, thumbUrl: thumb, title, author, platform: 'youtube' };
            }
        ];
        for (const api of apis) {
            try { const res = await api(); if (res?.videoUrl) return res; } catch (e) { console.error('[YT]', e.message); }
        }
        throw new Error('download_failed');
    }

    async sendDownloadResult(chatId, replyMsgId, result, platform) {
        const platformColors = {
            tiktok:    { style: 'danger',  emoji: '5350618807943576963' },
            instagram: { style: 'danger',  emoji: '5368324170671202286' },
            twitter:   { style: 'primary', emoji: '5339141594471742013' },
            facebook:  { style: 'primary', emoji: '5260450573768990626' },
            youtube:   { style: 'danger',  emoji: '5258084656674250503' },
        };
        const pc = platformColors[result.platform] || { style: 'primary', emoji: '5350618807943576963' };

        const statsLine = result.likes ? `❤️ ${Number(result.likes).toLocaleString()}  👁 ${Number(result.views || 0).toLocaleString()}` : '';
        const durLine   = result.duration > 0 ? `⏱ ${Math.floor(result.duration/60)}:${String(result.duration%60).padStart(2,'0')}` : '';

        const caption = `<tg-emoji emoji-id="${pc.emoji}">${platform.emoji}</tg-emoji> <b>${platform.name}</b>\n\n` +
            (result.title ? `📝 ${result.title.length > 80 ? result.title.slice(0,80)+'…' : result.title}\n` : '') +
            (result.author ? `👤 ${result.author}\n` : '') +
            (durLine ? `${durLine}\n` : '') +
            (statsLine ? `${statsLine}\n` : '') +
            `\n<i>via RKE Bypass Bot</i>`;

        const replyMarkup = { inline_keyboard: [[
            { text: platform.name, url: result.sourceUrl || url, icon_custom_emoji_id: pc.emoji, style: pc.style }
        ]] };

        if (!result.videoUrl) throw new Error('download_failed');

        // Download to tmp file
        const ext = result.type === 'photo' ? 'jpg' : 'mp4';
        const tmpPath = path.join('/tmp', `dl_${Date.now()}.${ext}`);
        const dlRes = await axios.get(result.videoUrl, {
            responseType: 'arraybuffer', timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.tiktok.com/' }
        });
        fs.writeFileSync(tmpPath, Buffer.from(dlRes.data));

        try {
            let sentDlMsg;
            if (result.type === 'photo') {
                sentDlMsg = await this.bot.sendPhoto(chatId, fs.createReadStream(tmpPath), {
                    caption, parse_mode: 'HTML', reply_to_message_id: replyMsgId, reply_markup: replyMarkup
                });
            } else {
                if (result.thumbUrl) {
                    try {
                        const tRes = await axios.get(result.thumbUrl, { responseType: 'arraybuffer', timeout: 8000 });
                        const tPath = path.join('/tmp', `dl_thumb_${Date.now()}.jpg`);
                        fs.writeFileSync(tPath, Buffer.from(tRes.data));
                        sentDlMsg = await this.bot.sendVideo(chatId, fs.createReadStream(tmpPath), {
                            caption, parse_mode: 'HTML', reply_to_message_id: replyMsgId,
                            reply_markup: replyMarkup, thumbnail: fs.createReadStream(tPath),
                            duration: result.duration || undefined, supports_streaming: true
                        });
                        fs.unlinkSync(tPath);
                    } catch {
                        sentDlMsg = await this.bot.sendVideo(chatId, fs.createReadStream(tmpPath), {
                            caption, parse_mode: 'HTML', reply_to_message_id: replyMsgId,
                            reply_markup: replyMarkup, supports_streaming: true
                        });
                    }
                } else {
                    sentDlMsg = await this.bot.sendVideo(chatId, fs.createReadStream(tmpPath), {
                        caption, parse_mode: 'HTML', reply_to_message_id: replyMsgId,
                        reply_markup: replyMarkup, supports_streaming: true
                    });
                }
            }
            return sentDlMsg?.message_id || null;
        } finally {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        }
    }

    // ==================== WARP MENU SYSTEM ====================

    loadWarpCount() {
        try {
            const f = 'warp_count.json';
            if (require('fs').existsSync(f)) {
                const parsed = JSON.parse(require('fs').readFileSync(f, 'utf-8'));
                return parseInt(parsed.count) || 0;
            }
        } catch {}
        return 0;
    }

    saveWarpCount() {
        try { require('fs').writeFileSync('warp_count.json', JSON.stringify({ count: this.warpTotalCount })); } catch {}
    }

    showWarpMenu(chatId) {
        const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
        const t = isEn ? {
            title: '⚡ <b>WireGuard WarpGen</b>',
            stats: `📊 <b>Total Generations:</b> ${(this.warpTotalCount || 0).toLocaleString()}`,
            sub: '🌐 <b>Choose Endpoint</b>',
            d1: '⚡ <b>Default</b> — Standard Cloudflare WARP',
            d2: '🇲🇲 <b>Myanmar</b> — ISP bypass (162.159.192.x)',
            d3: '🌐 <b>Other IPs</b> — 162.159.193.x / 188.114.x',
            d4: '🔓 <b>Port Options</b> — 443 / 500 / 1701',
            d5: '⚡ <b>Multi Config</b> — x3 / x5 / x10 at once',
            d6: '✏️ <b>Custom</b> — Enter your own IP:Port',
            btn_default: 'Default', btn_mm: 'Myanmar IPs', btn_ips: 'Other IPs',
            btn_ports: 'Ports', btn_multi: 'Multi Config', btn_custom: 'Custom IP',
            btn_how: 'How to Use', btn_site: 'WarpGen Site', btn_cancel: 'Cancel'
        } : {
            title: '⚡ <b>WireGuard WarpGen</b>',
            stats: `📊 <b>စုစုပေါင်း ထုတ်ယူမှု:</b> ${(this.warpTotalCount || 0).toLocaleString()} ကြိမ်`,
            sub: '🌐 <b>Endpoint ရွေးချယ်ပါ</b>',
            d1: '⚡ <b>Default</b> — Cloudflare WARP standard',
            d2: '🇲🇲 <b>Myanmar</b> — ISP bypass (162.159.192.x)',
            d3: '🌐 <b>Other IPs</b> — 162.159.193.x / 188.114.x',
            d4: '🔓 <b>Port</b> — 443 / 500 / 1701',
            d5: '⚡ <b>Multi Config</b> — x3 / x5 / x10 တစ်ပြိုင်နက်',
            d6: '✏️ <b>Custom</b> — ကိုယ်ပိုင် IP:Port ထည့်ပါ',
            btn_default: 'Default', btn_mm: 'Myanmar IPs', btn_ips: 'Other IPs',
            btn_ports: 'Ports', btn_multi: 'Multi Config', btn_custom: 'Custom IP',
            btn_how: 'အသုံးပြုနည်း', btn_site: 'WarpGen Site', btn_cancel: 'Cancel'
        };

        const text = `${t.title}\n\n${t.stats}\n\n${t.sub}\n\n${t.d1}\n${t.d2}\n${t.d3}\n${t.d4}\n${t.d5}\n${t.d6}`;

        return this.bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [
                [
                    { text: t.btn_default, callback_data: 'warp_gen_default',  icon_custom_emoji_id: '5350618807943576963', style: 'primary' },
                    { text: t.btn_custom,  callback_data: 'warp_custom_ip',    icon_custom_emoji_id: '5339141594471742013', style: 'success' }
                ],
                [
                    { text: 'MM-1',   callback_data: 'warp_gen_mm1',      icon_custom_emoji_id: '5368324170671202286', style: 'primary' },
                    { text: 'MM-2',   callback_data: 'warp_gen_mm2',      icon_custom_emoji_id: '5368324170671202286', style: 'primary' },
                    { text: 'MM-3',   callback_data: 'warp_gen_mm3',      icon_custom_emoji_id: '5368324170671202286', style: 'success' }
                ],
                [
                    { text: '193.1',   callback_data: 'warp_gen_193_1',    icon_custom_emoji_id: '6339280615459789282', style: 'primary' },
                    { text: '188.1',   callback_data: 'warp_gen_188_1',    icon_custom_emoji_id: '6339280615459789282', style: 'primary' },
                    { text: '188.2',   callback_data: 'warp_gen_188_2',    icon_custom_emoji_id: '6339280615459789282', style: 'success' }
                ],
                [
                    { text: 'Port 500', callback_data: 'warp_gen_p500', icon_custom_emoji_id: '5454386656628991407', style: 'danger' }
                ],
                [
                    { text: 'x3',      callback_data: 'warp_gen_multi3',   icon_custom_emoji_id: '5350618807943576963', style: 'success' },
                    { text: 'x5',      callback_data: 'warp_gen_multi5',   icon_custom_emoji_id: '5350618807943576963', style: 'success' },
                    { text: 'x10',     callback_data: 'warp_gen_multi10',  icon_custom_emoji_id: '5350618807943576963', style: 'danger'  }
                ],
                [
                    { text: t.btn_how,    callback_data: 'warp_how_to',       icon_custom_emoji_id: '5433811242135331842', style: 'primary' }
                ],
                [
                    { text: t.btn_cancel, callback_data: 'back_menu',         icon_custom_emoji_id: '5258084656674250503', style: 'danger'  }
                ]
            ]}
        });
    }

    showWarpHowTo(chatId) {
        const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';
        const text = isEn
            ? `<tg-emoji emoji-id="5433811242135331842">📖</tg-emoji> <b>How to Use WireGuard WARP</b>\n\n` +
              `<b>📱 Android / iOS:</b>\n` +
              `1. Download <b>WireGuard</b> from Store\n` +
              `2. Tap <b>(+)</b> → <b>Scan from QR code</b>\n` +
              `3. Scan the QR code sent by bot\n` +
              `4. Tap <b>Activate</b> to connect\n\n` +
              `<b>🖥 Windows / Mac:</b>\n` +
              `1. Install <b>WireGuard</b> app\n` +
              `2. Click <b>Add Tunnel</b> → <b>Import from file (.conf)</b>\n` +
              `3. Upload the <code>.conf</code> file sent by bot\n` +
              `4. Click <b>Activate</b> to connect\n\n` +
              `<b>💡 Tips for Myanmar Users:</b>\n` +
              `• Use <b>MM-1 / MM-2 / MM-3</b> IPs for best speed\n` +
              `• If blocked, try <b>Port 443</b> (HTTPS bypass)\n` +
              `• Use <b>Custom IP</b> to enter your own endpoint\n` +
              `• Generate <b>Multi Config</b> to find working one`
            : `<tg-emoji emoji-id="5433811242135331843">📖</tg-emoji> <b>WireGuard WARP အသုံးပြုနည်း</b>\n\n` +
              `<b>📱 Android / iOS:</b>\n` +
              `1. Store မှ <b>WireGuard</b> ဒေါင်းလုဒ်ပါ\n` +
              `2. <b>(+)</b> → <b>Scan from QR code</b> နိပ်ပါ\n` +
              `3. Bot ပေးသော QR Code ကို Scan ပါ\n` +
              `4. <b>Activate</b> နိပ်ပြီး ချိတ်ဆက်ပါ\n\n` +
              `<b>🖥 Windows / Mac:</b>\n` +
              `1. <b>WireGuard</b> app install ပါ\n` +
              `2. <b>Add Tunnel</b> → <b>Import from file (.conf)</b>\n` +
              `3. Bot ပေးသော <code>.conf</code> file upload ပါ\n` +
              `4. <b>Activate</b> နိပ်ပြီး ချိတ်ဆက်ပါ\n\n` +
              `<b>💡 မြန်မာ User များအတွက်:</b>\n` +
              `• <b>MM-1 / MM-2 / MM-3</b> IP သုံးပါ (အမြန်ဆုံး)\n` +
              `• ပိတ်ထားလျှင် <b>Port 443</b> ကြိုးစားကြည့်ပါ\n` +
              `• <b>Custom IP</b> နဲ့ ကိုယ်ပိုင် endpoint ထည့်နိုင်သည်\n` +
              `• <b>Multi Config</b> ထုတ်ပြီး အလုပ်ဖြစ်သောဟာ ရွေးပါ`;

        return this.bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [
                [
                    { text: isEn ? 'Back to WarpGen' : 'WarpGen ကိုပြန်', callback_data: 'warp_generate', icon_custom_emoji_id: '5260450573768990626', style: 'primary' },
                ],
                [
                    { text: 'WireGuard App', url: 'https://play.google.com/store/apps/details?id=com.wireguard.android', icon_custom_emoji_id: '5260450573768990626', style: 'danger' }
                ]
            ]}
        });
    }

    // Custom bypass for loot-link.com
    async _bypassLootLink(url) {
        const cheerio = (() => { try { return require('cheerio'); } catch { return null; } })();
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://google.com'
        };

        // Method 1: Follow redirect chain
        try {
            const r1 = await axios.get(url, {
                headers,
                maxRedirects: 10,
                timeout: 15000,
                validateStatus: () => true
            });
            // Look for redirect URLs in the response
            const finalUrl = r1.request?.res?.responseUrl || r1.config?.url || '';
            if (finalUrl && finalUrl !== url && !finalUrl.includes('loot-link.com')) {
                return { data: { result: finalUrl } };
            }
            // Parse HTML for destination link
            const html = typeof r1.data === 'string' ? r1.data : '';
            const urlMatch = html.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/);
            if (urlMatch) return { data: { result: urlMatch[1] } };
            const metaMatch = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^;]*;\s*url=([^"']+)["']/i);
            if (metaMatch) return { data: { result: metaMatch[1].trim() } };
        } catch {}

        // Method 2: Try bypass via bypasser.me
        try {
            const r2 = await axios.get(`https://bypasser.me/bypass?url=${encodeURIComponent(url)}`, { headers, timeout: 12000 });
            if (r2.data?.result) return { data: { result: r2.data.result } };
        } catch {}

        // Method 3: Fallback to main API anyway
        const r3 = await axios.get(`${this.apiBase}/bypass?url=${encodeURIComponent(url)}`, {
            headers: { 'x-api-key': this.apiKey },
            timeout: this.bypassTimeout
        });
        return r3;
    }

    async execWarpGeneration(chatId, customIp, customPort, label, count) {
        const isEn = (this.userLanguages?.[chatId] || 'en') === 'en';

        // Get user info for caption
        let userInfo = { first_name: '', username: '', id: chatId };
        try { userInfo = await this.bot.getChat(chatId); } catch {}
        const userName = userInfo.first_name || userInfo.username || 'User';
        const userHandle = userInfo.username ? `@${userInfo.username}` : `ID: ${chatId}`;

        const statusMsg = await this.bot.sendMessage(chatId,
            `<tg-emoji emoji-id="6053323501073341449">⌛</tg-emoji> ${isEn ? `Generating ${count} WARP Config...` : `WARP Config ${count > 1 ? count + ' ခု ' : ''}ထုတ်နေပါတယ်...`} [${label}]`,
            { parse_mode: 'HTML' }
        );
        try {
            for (let i = 0; i < count; i++) {
                const cfg = await this.generateWarpConfig(customIp, customPort);
                const configText = this.buildWarpConfigFile(cfg);
                const indexLabel = count > 1 ? ` #${i+1}` : '';
                const endpointDisplay = cfg.endpoint;
                const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Yangon', hour12: false });

                // QR Caption
                const qrCaption =
                    `<tg-emoji emoji-id="5350618807943576963">⚡</tg-emoji> <b>KoPudding WarpGen${indexLabel}</b>\n` +
                    `<tg-emoji emoji-id="5368324170671202286">🔗</tg-emoji> <b>Endpoint:</b> <code>${endpointDisplay}</code>\n\n` +
                    `<tg-emoji emoji-id="5258084656674250503">🔑</tg-emoji> <b>License:</b> <code>${cfg.license}</code>\n` +
                    `<tg-emoji emoji-id="5339141594471742013">📱</tg-emoji> <b>Device ID:</b> <code>${cfg.deviceId}</code>\n` +
                    `<tg-emoji emoji-id="6339280615459789282">🌐</tg-emoji> <b>IPv4:</b> <code>${cfg.v4}</code>\n\n` +
                    `<tg-emoji emoji-id="5433811242135331842">👤</tg-emoji> <b>User:</b> ${userName} (${userHandle})\n` +
                    `<tg-emoji emoji-id="6053323501073341449">🕐</tg-emoji> <b>Time:</b> ${now}\n\n` +
                    (isEn ? `📲 Scan QR with WireGuard App` : `📲 WireGuard App နဲ့ QR Scan လုပ်ပါ`);

                // .conf Caption  
                const confCaption =
                    `<tg-emoji emoji-id="5350618807943576963">⚡</tg-emoji> <b>KoPuddingWarp${indexLabel}.conf</b>\n` +
                    `<tg-emoji emoji-id="5368324170671202286">🔗</tg-emoji> <b>Endpoint:</b> <code>${endpointDisplay}</code>\n\n` +
                    `<tg-emoji emoji-id="5258084656674250503">🔑</tg-emoji> <b>License:</b> <code>${cfg.license}</code>\n` +
                    `<tg-emoji emoji-id="5339141594471742013">📱</tg-emoji> <b>Device ID:</b> <code>${cfg.deviceId}</code>\n` +
                    `<tg-emoji emoji-id="6339280615459789282">🌐</tg-emoji> <b>IPv4:</b> <code>${cfg.v4}</code>\n\n` +
                    `<tg-emoji emoji-id="5433811242135331842">👤</tg-emoji> <b>User:</b> ${userName} (${userHandle})\n` +
                    `<tg-emoji emoji-id="6053323501073341449">🕐</tg-emoji> <b>Time:</b> ${now}`;

                const botUsername = (await this.bot.getMe().catch(() => ({username:''})))?.username || '';
                const shareText = isEn
                    ? `🛡 WireGuard WARP Config by @${botUsername}\nEndpoint: ${endpointDisplay}`
                    : `🛡 WireGuard WARP Config — @${botUsername}\nEndpoint: ${endpointDisplay}`;

                const qrReplyMarkup = { inline_keyboard: [[
                    { text: isEn ? 'WireGuard App' : 'Install App', url: 'https://play.google.com/store/apps/details?id=com.wireguard.android', icon_custom_emoji_id: '5260450573768990626', style: 'danger' },
                    { text: isEn ? 'How to Use' : 'အသုံးပြုနည်း', callback_data: 'warp_how_to', icon_custom_emoji_id: '5433811242135331842', style: 'primary' }
                ]] };

                const confReplyMarkup = { inline_keyboard: [
                    [
                        { text: isEn ? 'WireGuard App' : 'Install App', url: 'https://play.google.com/store/apps/details?id=com.wireguard.android', icon_custom_emoji_id: '5260450573768990626', style: 'danger' },
                        { text: isEn ? 'Share Config' : 'Share', url: `https://t.me/share/url?url=${encodeURIComponent(`KoPuddingWarp.conf`)}&text=${encodeURIComponent(shareText)}`, icon_custom_emoji_id: '5368324170671202286', style: 'success' }
                    ],
                    [
                        { text: isEn ? 'Gen Another' : 'ထပ်ထုတ်မည်', callback_data: 'warp_generate', icon_custom_emoji_id: '5350618807943576963', style: 'primary' }
                    ]
                ]};

                // Send QR photo
                const qrConfig = this.buildWarpQrConfig(cfg);
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&ecc=M&data=${encodeURIComponent(qrConfig)}`;
                const qrPath = path.join('/tmp', `warp_qr_${Date.now()}_${i}.png`);
                let qrSent = false;
                try {
                    const qrRes = await axios.get(qrUrl, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                    fs.writeFileSync(qrPath, Buffer.from(qrRes.data));
                    await this.bot.sendPhoto(chatId, fs.createReadStream(qrPath), { caption: qrCaption, parse_mode: 'HTML', reply_markup: qrReplyMarkup });
                    fs.unlinkSync(qrPath);
                    qrSent = true;
                } catch { if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath); }

                // Send KoPuddingWarp.conf file
                const confNum = count > 1 ? `${i+1}` : '';
                const confFilename = `KoPuddingWarp${confNum}.conf`;
                const tmpConf = path.join('/tmp', `kpwarp_${Date.now()}_${i}.conf`);
                fs.writeFileSync(tmpConf, Buffer.from(configText, 'utf-8'));
                await this.bot.sendDocument(chatId, fs.createReadStream(tmpConf),
                    { caption: confCaption, parse_mode: 'HTML', reply_markup: confReplyMarkup },
                    { filename: confFilename });
                fs.unlinkSync(tmpConf);

                // Update counter
                this.warpTotalCount++;
                this.saveWarpCount();
            }
            await this.bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
        } catch (err) {
            console.error('WARP exec error:', err.message);
            await this.bot.editMessageText(
                isEn ? `❌ WARP config generation failed.` : `❌ WARP config ထုတ်ရာမှာ အဆင်မပြေပါ။`,
                { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'HTML' }
            ).catch(() => {});
        }
    }

    // ==================== WARP CONFIG GENERATOR (WarpConfGen) ====================

    async generateWarpConfig(customIp = null, customPort = null) {
        // Generate a WireGuard keypair via Cloudflare WARP API
        // Based on: https://github.com/devtint/WarpConfGen

        const { privateKey, publicKey } = this.generateWireGuardKeypair();

        const apiBase = 'https://api.cloudflareclient.com/v0a2223';
        const headers = {
            'User-Agent': '1.1.1.1/6.30 CFNetwork/1490.0.4 Darwin/23.2.0',
            'CF-Client-Version': 'a-6.30-2223',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        const regBody = {
            key: publicKey,
            install_id: this.randomHex(22),
            fcm_token: '',
            tos: new Date().toISOString(),
            type: 'ios',
            locale: 'en_US'
        };

        const regRes = await axios.post(`${apiBase}/reg`, regBody, { headers, timeout: 15000 });
        const regData = regRes.data;

        const deviceId = regData.id;
        const token = regData.token;
        const license = regData.account?.license || '';
        const v4 = regData.config?.interface?.addresses?.v4 || '';
        const v6 = regData.config?.interface?.addresses?.v6 || '';
        const peerPubKey = regData.config?.peers?.[0]?.public_key || 'bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo=';
        const clientId = regData.config?.client_id || '';

        // Use custom endpoint if provided, else use API response endpoint
        let endpoint = regData.config?.peers?.[0]?.endpoint?.host || 'engage.cloudflareclient.com:2408';
        if (customIp) {
            const port = customPort || endpoint.split(':')[1] || '2408';
            endpoint = `${customIp}:${port}`;
        } else if (customPort) {
            const ip = endpoint.split(':')[0];
            endpoint = `${ip}:${customPort}`;
        }

        return { privateKey, publicKey, deviceId, token, license, v4, v6, peerPubKey, endpoint, clientId };
    }

    buildWarpQrConfig(cfg) {
        // Minimal WireGuard config for QR code (mobile-friendly, no PostUp/PostDown)
        const reserved = this.clientIdToReserved(cfg.clientId);
        return `[Interface]
PrivateKey = ${cfg.privateKey}
Address = ${cfg.v4}/32, ${cfg.v6}/128
DNS = 1.1.1.1, 1.0.0.1
MTU = 1280

[Peer]
PublicKey = ${cfg.peerPubKey}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${cfg.endpoint}${reserved ? `
Reserved = ${reserved}` : ''}
PersistentKeepalive = 25`;
    }

    buildWarpConfigFile(cfg) {
        const reserved = this.clientIdToReserved(cfg.clientId);
        return `[Interface]
PrivateKey = ${cfg.privateKey}
Address = ${cfg.v4}/32, ${cfg.v6}/128
DNS = 1.1.1.1, 1.0.0.1, 2606:4700:4700::1111, 2606:4700:4700::1001
MTU = 1280
PostUp = ip rule add from ${cfg.v4} lookup main
PostDown = ip rule del from ${cfg.v4} lookup main

[Peer]
PublicKey = ${cfg.peerPubKey}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${cfg.endpoint}${reserved ? `
Reserved = ${reserved}` : ''}
PersistentKeepalive = 25
`;
    }

    generateWireGuardKeypair() {
        // WireGuard uses Curve25519 keys
        // Node.js crypto supports x25519 for DH but not direct WireGuard key format
        // We use a compatible approach
        try {
            const { generateKeyPairSync } = require('crypto');
            const { privateKey: privKeyObj, publicKey: pubKeyObj } = generateKeyPairSync('x25519');
            const privDer = privKeyObj.export({ type: 'pkcs8', format: 'der' });
            const pubDer = pubKeyObj.export({ type: 'spki', format: 'der' });
            // Extract raw 32 bytes
            const privRaw = privDer.slice(-32);
            const pubRaw = pubDer.slice(-32);
            return {
                privateKey: privRaw.toString('base64'),
                publicKey: pubRaw.toString('base64')
            };
        } catch (e) {
            // Fallback: random base64 keys (for display only)
            const priv = require('crypto').randomBytes(32);
            priv[0] &= 248; priv[31] &= 127; priv[31] |= 64;
            return {
                privateKey: priv.toString('base64'),
                publicKey: require('crypto').randomBytes(32).toString('base64')
            };
        }
    }

    clientIdToReserved(clientId) {
        if (!clientId) return '';
        try {
            const buf = Buffer.from(clientId, 'base64');
            return `${buf[0]}, ${buf[1]}, ${buf[2]}`;
        } catch (e) { return ''; }
    }

    randomHex(len) {
        return require('crypto').randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    extractCleanDomain(url) {
        try {
            const urlObj = new URL(url);
            let hostname = urlObj.hostname.replace('www.', '');
            
            const parts = hostname.split('.');
            
            if (parts.length === 0) return 'unknown';
            
            if (parts.length > 2) {
                return parts[1];
            } else {
                return parts[0];
            }
        } catch (error) {
            return 'unknown';
        }
    }
}

// ==================== BOT CONFIGURATION ====================
const BOT_TOKEN = '7366045096:AAE2Yr8wbr-1zEaG1kghZ5vO3lgO6YQRutk';

// Helper function to get Myanmar time (for startup log)
function getMyanmarTimeForStartup() {
    const myanmarTimezoneOffset = 6.5 * 60 * 60 * 1000;
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const myanmarTime = new Date(utc + myanmarTimezoneOffset);
    
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    };
    return myanmarTime.toLocaleString('en-US', options);
}

try {
    console.log(`
    ============================================
    🤖 RKE Key Bypass Bot စတင်နေပါပြီ...
    🔔 Bot Token: ${BOT_TOKEN.substring(0, 15)}...
    🌐 API Key: 0440e329-12ac-41a1-b382-bb54c28100f5
    👑 Admin IDs: 6357622851, 6768862370
    🔗 Deep Link System Activated
    📊 History System Activated
    ✍️ Feedback System Activated
    🤝 Supporting System Activated
    👥 User Management Activated
    🚫 Ban System Activated
    🗑️ Auto-Delete Bypass Links Activated
    ⚡ Luarmor Domain Support Activated
    ⚡ Auto-Delete System Activated
    ⚡ Channel Post System Activated
    ⚡ Advanced Broadcast System Activated
    ⚡ Payment/Support System Activated
    ⚡ Feedback System Activated
    ⚡ User Ban System Activated
    ⚡ Deep Link Join Enforcement Activated
    ⚡ Automatic Hyperlink Conversion Activated
    ⚡ Enhanced Button Preview (shows User IDs)
    ⚡ Personalized Broadcast (first_name, username, userid)
    ⚡ Emoji Quick Picker in Post Creation
    ⚡ Dedicated Copy Button for Posts
    ⚡ /warp WARP Config Generator (QR + .conf)
    ⚡ Premium Custom Emoji Support (emoji:ID | text)
    ⚡ Group Moderation (Banned Words, Auto Mute, Unmute Button)
    ⚡ Bot API 9.4 Button Features: Emoji on Buttons & Button Styles for Inline and Reply Keyboards!
    🕒 Start Time: ${getMyanmarTimeForStartup()}
    ============================================`);

    // Create bot instance
    const bot = new RKEBypassBot(BOT_TOKEN);
    
    // Graceful shutdown handling
    process.on('SIGINT', () => {
        console.log('\n\n🤖 Bot is shutting down...');
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n\n🤖 Bot received termination signal...');
        process.exit(0);
    });
    
    process.on('uncaughtException', (error) => {
        console.error('❌ Uncaught Exception:', error);
        // Don't exit, let the bot continue running
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
} catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
}
