const fetch = require('node-fetch');

const THREADS_API_BASE = 'https://graph.threads.net';
const THREADS_AUTH_URL = 'https://threads.net/oauth/authorize';

class ThreadsAPI {
  /**
   * Generate OAuth2 authorization URL
   */
  static getAuthorizationUrl(account) {
    const scopes = [
      'threads_basic',
      'threads_content_publish',
      'threads_manage_replies',
      'threads_read_replies'
    ].join(',');

    const params = new URLSearchParams({
      client_id: account.app_id,
      redirect_uri: account.redirect_uri,
      scope: scopes,
      response_type: 'code',
      state: String(account.id)
    });

    return `${THREADS_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for short-lived access token
   */
  static async exchangeCodeForToken(code, account) {
    console.log('[ThreadsAPI] Exchanging code for token...');
    console.log('[ThreadsAPI] client_id:', account.app_id);
    console.log('[ThreadsAPI] client_secret length:', account.app_secret?.length);
    console.log('[ThreadsAPI] redirect_uri:', account.redirect_uri);
    
    const response = await fetch(`${THREADS_API_BASE}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: account.app_id.trim(),
        client_secret: account.app_secret.trim(),
        grant_type: 'authorization_code',
        redirect_uri: account.redirect_uri,
        code: code
      })
    });

    const data = await response.json();
    if (data.error) {
      console.error('[ThreadsAPI] Token exchange error:', JSON.stringify(data, null, 2));
      throw new Error(`Token exchange failed: ${data.error_message || JSON.stringify(data.error)}`);
    }
    return data; // { access_token, user_id }
  }

  /**
   * Exchange short-lived token for long-lived token (90 days)
   */
  static async getLongLivedToken(shortLivedToken, appSecret) {
    const params = new URLSearchParams({
      grant_type: 'th_exchange_token',
      client_secret: appSecret,
      access_token: shortLivedToken
    });

    const response = await fetch(
      `${THREADS_API_BASE}/access_token?${params.toString()}`
    );
    const data = await response.json();
    if (data.error) {
      throw new Error(`Long-lived token exchange failed: ${data.error?.message || data.error}`);
    }
    return data; // { access_token, token_type, expires_in }
  }

  /**
   * Refresh a long-lived token
   */
  static async refreshToken(accessToken) {
    const params = new URLSearchParams({
      grant_type: 'th_refresh_token',
      access_token: accessToken
    });

    const response = await fetch(
      `${THREADS_API_BASE}/refresh_access_token?${params.toString()}`
    );
    const data = await response.json();
    if (data.error) {
      throw new Error(`Token refresh failed: ${data.error?.message || data.error}`);
    }
    return data; // { access_token, token_type, expires_in }
  }

  /**
   * Get user profile
   */
  static async getUserProfile(accessToken) {
    const params = new URLSearchParams({
      fields: 'id,username,name,threads_profile_picture_url,threads_biography',
      access_token: accessToken
    });

    const response = await fetch(`${THREADS_API_BASE}/v1.0/me?${params.toString()}`);
    const data = await response.json();
    if (data.error) {
      throw new Error(`Profile fetch failed: ${data.error?.message || data.error}`);
    }
    return data;
  }

  /**
   * Create a text post container
   */
  static async createPostContainer(userId, accessToken, text, replyToId = null) {
    const body = {
      media_type: 'TEXT',
      text: text,
      access_token: accessToken
    };

    if (replyToId) {
      body.reply_to_id = replyToId;
    }

    const response = await fetch(`${THREADS_API_BASE}/v1.0/${userId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body)
    });

    const data = await response.json();
    if (data.error) {
      const errMsg = data.error?.message || JSON.stringify(data.error);
      // Detect rate limit
      if (response.status === 429 || errMsg.includes('rate limit')) {
        const err = new Error(`Rate limited: ${errMsg}`);
        err.rateLimited = true;
        throw err;
      }
      throw new Error(`Create container failed: ${errMsg}`);
    }
    return data; // { id: container_id }
  }

  /**
   * Publish a post container
   */
  static async publishPost(userId, accessToken, containerId) {
    const response = await fetch(`${THREADS_API_BASE}/v1.0/${userId}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: containerId,
        access_token: accessToken
      })
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`Publish failed: ${data.error?.message || data.error}`);
    }
    return data; // { id: media_id }
  }

  /**
   * Create and publish a text post with retry
   */
  static async postText(userId, accessToken, text, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const container = await this.createPostContainer(userId, accessToken, text);
        await this.sleep(3000);
        const published = await this.publishPost(userId, accessToken, container.id);
        return published;
      } catch (error) {
        if (error.rateLimited && attempt < retries) {
          const backoff = attempt * 30000; // 30s, 60s, 90s
          console.warn(`[ThreadsAPI] Rate limited, retrying in ${backoff / 1000}s (attempt ${attempt}/${retries})`);
          await this.sleep(backoff);
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Create and publish a reply with retry
   */
  static async postReply(userId, accessToken, replyToId, text, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const container = await this.createPostContainer(userId, accessToken, text, replyToId);
        await this.sleep(3000);
        const published = await this.publishPost(userId, accessToken, container.id);
        return published;
      } catch (error) {
        if (error.rateLimited && attempt < retries) {
          const backoff = attempt * 30000;
          console.warn(`[ThreadsAPI] Rate limited, retrying in ${backoff / 1000}s (attempt ${attempt}/${retries})`);
          await this.sleep(backoff);
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Get replies to a post
   */
  static async getReplies(mediaId, accessToken) {
    const params = new URLSearchParams({
      fields: 'id,text,username,timestamp',
      access_token: accessToken
    });

    const response = await fetch(
      `${THREADS_API_BASE}/v1.0/${mediaId}/replies?${params.toString()}`
    );
    const data = await response.json();
    if (data.error) {
      throw new Error(`Get replies failed: ${data.error?.message || data.error}`);
    }
    return data.data || [];
  }

  /**
   * Get conversation (all nested replies)
   */
  static async getConversation(mediaId, accessToken) {
    const params = new URLSearchParams({
      fields: 'id,text,username,timestamp',
      access_token: accessToken,
      reverse: 'true'
    });

    const response = await fetch(
      `${THREADS_API_BASE}/v1.0/${mediaId}/conversation?${params.toString()}`
    );
    const data = await response.json();
    if (data.error) {
      throw new Error(`Get conversation failed: ${data.error?.message || data.error}`);
    }
    return data.data || [];
  }

  /**
   * Get user's recent posts
   */
  static async getUserPosts(userId, accessToken, limit = 10) {
    const params = new URLSearchParams({
      fields: 'id,text,timestamp,is_quote_post',
      access_token: accessToken,
      limit: String(limit)
    });

    const response = await fetch(
      `${THREADS_API_BASE}/v1.0/${userId}/threads?${params.toString()}`
    );
    const data = await response.json();
    if (data.error) {
      throw new Error(`Get user posts failed: ${data.error?.message || data.error}`);
    }
    return data.data || [];
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ThreadsAPI;
