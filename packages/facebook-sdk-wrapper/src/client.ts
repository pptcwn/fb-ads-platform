import axios from 'axios';

const FB_API_BASE = 'https://graph.facebook.com/v18.0';

export class FacebookClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private get headers() {
    return { Authorization: `Bearer ${this.token}` };
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const { data } = await axios.get(`${FB_API_BASE}/${path}`, {
      headers: this.headers,
      params,
    });
    return data;
  }

  async post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    const { data } = await axios.post(`${FB_API_BASE}/${path}`, body, {
      headers: this.headers,
    });
    return data;
  }

  async delete<T>(path: string): Promise<T> {
    const { data } = await axios.delete(`${FB_API_BASE}/${path}`, {
      headers: this.headers,
    });
    return data;
  }
}
