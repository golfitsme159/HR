const axios = require('axios');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { toISODate } = require('../utils/dateUtils');

const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';

/**
 * Verifies a LINE ID token obtained from LIFF (`liff.getIDToken()`).
 *
 * In production this calls LINE's verify endpoint, which validates the token
 * signature/expiry/audience and returns the decoded payload. The `sub` field
 * is the stable LINE user id.
 *
 * In mock mode (LINE_MOCK_ENABLED=true or no LINE_CHANNEL_ID) the raw idToken
 * is treated as the lineUserId so the flow can be exercised without LINE.
 *
 * @param {string} idToken
 * @returns {Promise<{sub: string, name?: string, picture?: string, email?: string}>}
 */
async function verifyLineIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new ApiError(400, 'idToken is required');
  }

  if (env.lineMockEnabled) {
    return { sub: `mock:${idToken}`, name: 'Mock LINE User' };
  }

  try {
    const body = new URLSearchParams({
      id_token: idToken,
      client_id: env.lineChannelId,
    }).toString();

    const { data } = await axios.post(LINE_VERIFY_URL, body, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 8000,
    });

    if (!data || !data.sub) {
      throw new ApiError(401, 'LINE token verification returned no subject');
    }
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;

    // LINE returns 400 with { error, error_description } for invalid tokens.
    const description = err.response?.data?.error_description || err.message;
    throw new ApiError(401, `LINE token verification failed: ${description}`);
  }
}

// ---- Push notifications (Messaging API) ---------------------------------

// Lazily-built Messaging API client. Kept lazy (and require()d inside a
// try/catch) so the server boots even when the SDK isn't installed or no
// channel access token is configured (e.g. local/dev/mock mode).
let messagingClient = null;
let clientResolved = false;

function getMessagingClient() {
  if (clientResolved) return messagingClient;
  clientResolved = true;

  if (!env.lineChannelAccessToken) {
    messagingClient = null;
    return null;
  }
  try {
    const line = require('@line/bot-sdk');
    // SDK v7/v8 exposed `line.Client`; v9+ exposes `messagingApi.MessagingApiClient`.
    if (line.messagingApi?.MessagingApiClient) {
      messagingClient = new line.messagingApi.MessagingApiClient({
        channelAccessToken: env.lineChannelAccessToken,
      });
    } else if (line.Client) {
      messagingClient = new line.Client({ channelAccessToken: env.lineChannelAccessToken });
    } else {
      messagingClient = null;
    }
  } catch (err) {
    // Module missing or failed to load — degrade gracefully.
    console.warn('[lineService] @line/bot-sdk unavailable; push disabled:', err.message);
    messagingClient = null;
  }
  return messagingClient;
}

/** True when we can actually deliver a push (real token + a non-mock target). */
function canPush(lineUserId) {
  if (env.lineMockEnabled) return false;
  if (!lineUserId || String(lineUserId).startsWith('mock:')) return false;
  return Boolean(getMessagingClient());
}

/** Sends a push message, tolerating both the v9+ and legacy SDK signatures. */
async function pushMessage(to, messages) {
  const client = getMessagingClient();
  if (!client) return;
  if (typeof client.pushMessage === 'function' && client.pushMessage.length >= 1) {
    // v9+ takes a single request object; legacy takes (to, messages).
    try {
      await client.pushMessage({ to, messages });
      return;
    } catch (err) {
      // If the object-form call fails because this is the legacy signature,
      // retry with positional args before giving up.
      if (err instanceof TypeError) {
        await client.pushMessage(to, messages);
        return;
      }
      throw err;
    }
  }
}

const THEME = {
  APPROVED: { color: '#16A34A', bg: '#ECFDF5', label: 'Approved', emoji: '✅' },
  REJECTED: { color: '#DC2626', bg: '#FEF2F2', label: 'Rejected', emoji: '⛔' },
};

/** Human date like "Tue, 14 Jul 2026" for the message body. */
function formatDisplayDate(date) {
  return new Date(date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Builds an elegant LINE Flex bubble for a WFH/Leave decision.
 * @param {'WFH'|'LEAVE'} kind
 * @param {'APPROVED'|'REJECTED'} status
 * @param {string} dateText  already-formatted date (or range) string
 * @param {string} hrNickname
 */
function buildStatusFlex(kind, status, dateText, hrNickname) {
  const theme = THEME[status] || THEME.REJECTED;
  const title = kind === 'LEAVE' ? 'Leave Request' : 'WFH Request';
  const dateLabel = kind === 'LEAVE' ? 'Leave date' : 'WFH date';

  const bodyRows = [
    {
      type: 'box',
      layout: 'baseline',
      spacing: 'sm',
      contents: [
        { type: 'text', text: dateLabel, color: '#8A8A8A', size: 'sm', flex: 2 },
        { type: 'text', text: dateText, wrap: true, color: '#1A1A1A', size: 'sm', flex: 4, weight: 'bold' },
      ],
    },
    {
      type: 'box',
      layout: 'baseline',
      spacing: 'sm',
      contents: [
        { type: 'text', text: 'Status', color: '#8A8A8A', size: 'sm', flex: 2 },
        { type: 'text', text: `${theme.emoji} ${theme.label}`, color: theme.color, size: 'sm', flex: 4, weight: 'bold' },
      ],
    },
  ];

  if (status === 'APPROVED' && hrNickname) {
    bodyRows.push({
      type: 'box',
      layout: 'baseline',
      spacing: 'sm',
      contents: [
        { type: 'text', text: 'Approved by', color: '#8A8A8A', size: 'sm', flex: 2 },
        { type: 'text', text: hrNickname, wrap: true, color: '#1A1A1A', size: 'sm', flex: 4 },
      ],
    });
  }

  const footerText =
    status === 'APPROVED'
      ? 'Your request has been approved. Enjoy!'
      : 'Your request was not approved. Please contact HR for details.';

  return {
    type: 'flex',
    altText: `${title} ${theme.label}: ${dateText}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: theme.color,
        paddingAll: '16px',
        contents: [
          { type: 'text', text: 'Nilecon HR', color: '#FFFFFF', size: 'xs', weight: 'bold' },
          { type: 'text', text: `${title} ${theme.label}`, color: '#FFFFFF', size: 'lg', weight: 'bold', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: theme.bg,
        spacing: 'md',
        paddingAll: '16px',
        contents: bodyRows,
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: footerText, wrap: true, size: 'xs', color: '#6B6B6B' },
        ],
      },
    },
  };
}

/**
 * Sends a WFH decision notification to the employee via LINE Push Message.
 * Best-effort: never throws — a missing/invalid token or dev/mock mode simply
 * results in a skipped (logged) push so HR decisions never fail on this.
 *
 * @param {string} lineUserId       the employee's LINE user id
 * @param {'APPROVED'|'REJECTED'} status
 * @param {string|Date} requestedDate
 * @param {string} hrNickname       nickname of the approving HR user
 */
async function sendWfhStatusNotification(lineUserId, status, requestedDate, hrNickname) {
  return sendStatusNotification('WFH', lineUserId, status, formatDisplayDate(requestedDate), hrNickname);
}

/**
 * Sends a Leave decision notification to the employee via LINE Push Message.
 * Same best-effort semantics as sendWfhStatusNotification.
 */
async function sendLeaveStatusNotification(lineUserId, status, startDate, endDate, hrNickname) {
  const sameDay = toISODate(startDate) === toISODate(endDate);
  const dateText = sameDay
    ? formatDisplayDate(startDate)
    : `${formatDisplayDate(startDate)} → ${formatDisplayDate(endDate)}`;
  return sendStatusNotification('LEAVE', lineUserId, status, dateText, hrNickname);
}

async function sendStatusNotification(kind, lineUserId, status, dateText, hrNickname) {
  if (!['APPROVED', 'REJECTED'].includes(status)) return;

  if (!canPush(lineUserId)) {
    console.info(
      `[lineService] Skipping ${kind} push (mock/dev or no token) → ${lineUserId} : ${status} ${dateText}`
    );
    return;
  }

  try {
    const flex = buildStatusFlex(kind, status, dateText, hrNickname);
    await pushMessage(lineUserId, [flex]);
  } catch (err) {
    // Never let a notification failure break the HR decision flow.
    const detail = err.response?.data?.message || err.message;
    console.error(`[lineService] Failed to push ${kind} notification: ${detail}`);
  }
}

module.exports = {
  verifyLineIdToken,
  sendWfhStatusNotification,
  sendLeaveStatusNotification,
};
