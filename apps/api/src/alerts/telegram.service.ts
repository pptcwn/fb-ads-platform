import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly apiBase = 'https://api.telegram.org/bot';

  constructor(private readonly http: HttpService) {}

  async sendMessage(botToken: string, chatId: string, text: string): Promise<{ success: boolean; error?: string }> {
    try {
      const url = `${this.apiBase}${botToken}/sendMessage`;
      const res = await firstValueFrom(
        this.http.post(url, {
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      );

      if (res.data?.ok) {
        this.logger.log(`✅ Telegram message sent to ${chatId}`);
        return { success: true };
      }

      return { success: false, error: res.data?.description || 'Unknown error' };
    } catch (err: any) {
      const msg = err?.response?.data?.description || err.message || 'Connection failed';
      this.logger.error(`❌ Telegram send failed: ${msg}`);
      return { success: false, error: msg };
    }
  }

  async testConnection(botToken: string, chatId: string): Promise<{ success: boolean; error?: string; botName?: string }> {
    try {
      // Test the bot token first
      const meUrl = `${this.apiBase}${botToken}/getMe`;
      const meRes = await firstValueFrom(this.http.get(meUrl));

      if (!meRes.data?.ok) {
        return { success: false, error: meRes.data?.description || 'Invalid bot token' };
      }

      const botName = meRes.data.result?.first_name || 'Bot';

      // Send a test message to the chat
      const msgResult = await this.sendMessage(
        botToken, chatId,
        `🤖 <b>FB Ads Platform</b>\n\n✅ Telegram connected successfully!\n\nYour alerts will appear here.`,
      );

      if (!msgResult.success) {
        return {
          success: false,
          error: `Bot "${botName}" is valid, but can't send to this chat.\nMake sure you:\n1. Start a chat with @${meRes.data.result?.username || 'the bot'}\n2. Send /start to the bot first\n3. Use the correct Chat ID\n\nError: ${msgResult.error}`,
        };
      }

      return { success: true, botName };
    } catch (err: any) {
      const msg = err?.response?.data?.description || err.message || 'Connection failed';
      return { success: false, error: msg };
    }
  }

  formatAlert(title: string, message: string, severity: string, category: string): string {
    const icons: Record<string, string> = {
      CRITICAL: '🚨', WARNING: '⚠️', INFO: 'ℹ️',
      BUDGET: '💰', PERFORMANCE: '📊', CAMPAIGN: '📢',
      TOKEN: '🔑', AB_TEST: '🔁', SYNC: '🔄', SYSTEM: '🤖',
    };

    const icon = icons[severity] || icons[category] || '🔔';
    return `${icon} <b>${this.escapeHtml(title)}</b>\n${this.escapeHtml(message)}`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
