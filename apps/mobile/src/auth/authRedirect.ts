import 'react-native-url-polyfill/auto';

import * as Linking from 'expo-linking';

const AUTH_REDIRECT_PATH = 'auth/callback';
const AUTH_REDIRECT_SCHEME = 'weekly';

type SupabaseAuthRedirectParams = {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  errorDescription: string | null;
};

export function createMobileAuthRedirectUrl() {
  return Linking.createURL(AUTH_REDIRECT_PATH, {
    scheme: AUTH_REDIRECT_SCHEME,
  });
}

export function parseSupabaseAuthRedirectUrl(url: string): SupabaseAuthRedirectParams | null {
  const params = collectUrlParams(url);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const code = params.get('code');
  const errorDescription = params.get('error_description') ?? params.get('error');

  if (!accessToken && !refreshToken && !code && !errorDescription) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    code,
    errorDescription,
  };
}

function collectUrlParams(url: string) {
  const params = new URLSearchParams();
  const queryStartIndex = url.indexOf('?');
  const hashStartIndex = url.indexOf('#');

  if (queryStartIndex >= 0) {
    const queryEndIndex =
      hashStartIndex >= 0 && hashStartIndex > queryStartIndex ? hashStartIndex : url.length;
    appendParams(params, url.slice(queryStartIndex + 1, queryEndIndex));
  }

  if (hashStartIndex >= 0) {
    appendParams(params, url.slice(hashStartIndex + 1));
  }

  return params;
}

function appendParams(target: URLSearchParams, rawParams: string) {
  const source = new URLSearchParams(rawParams);

  source.forEach((value, key) => {
    target.set(key, value);
  });
}
