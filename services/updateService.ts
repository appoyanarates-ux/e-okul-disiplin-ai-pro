// Update checker service for E-Okul Disiplin AI Pro
// Checks GitHub Releases and handles download progress

export const getAppVersion = (): string => {
  if (typeof window !== 'undefined' && window.electronAPI?.version) {
    return window.electronAPI.version;
  }
  return '1.1.6';
};

export const GITHUB_REPO = 'appoyanarates-ux/e-okul-disiplin-ai-pro';

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string;
  setupAsset?: {
    id?: number;
    name: string;
    size: number;
    url?: string;
    browser_download_url: string;
  };
  portableAsset?: {
    id?: number;
    name: string;
    size: number;
    url?: string;
    browser_download_url: string;
  };
}

export interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  speed: number;
}

// Compare semantic version numbers e.g. "1.0.1" > "1.0.0"
export function compareVersions(v1: string, v2: string): number {
  const cleanV1 = v1.replace(/^v/i, '').trim();
  const cleanV2 = v2.replace(/^v/i, '').trim();

  const p1 = cleanV1.split('.').map(n => parseInt(n, 10) || 0);
  const p2 = cleanV2.split('.').map(n => parseInt(n, 10) || 0);

  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export async function checkForAppUpdates(): Promise<UpdateInfo | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('No GitHub releases published yet.');
        return null;
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const release = await response.json();
    const latestTag = release.tag_name || '';
    const cleanTag = latestTag.replace(/^v/i, '');

    const currentVersion = getAppVersion();
    const hasUpdate = compareVersions(cleanTag, currentVersion) > 0;

    const setupAssetRaw = release.assets?.find((a: any) => 
      a.name.toLowerCase().includes('setup') && a.name.toLowerCase().endsWith('.exe')
    ) || release.assets?.find((a: any) => a.name.toLowerCase().endsWith('.exe'));

    const portableAssetRaw = release.assets?.find((a: any) => 
      a.name.toLowerCase().includes('portable') && a.name.toLowerCase().endsWith('.exe')
    );

    const setupAsset = setupAssetRaw ? {
      id: setupAssetRaw.id,
      name: setupAssetRaw.name,
      size: setupAssetRaw.size,
      url: setupAssetRaw.url,
      browser_download_url: setupAssetRaw.browser_download_url
    } : undefined;

    const portableAsset = portableAssetRaw ? {
      id: portableAssetRaw.id,
      name: portableAssetRaw.name,
      size: portableAssetRaw.size,
      url: portableAssetRaw.url,
      browser_download_url: portableAssetRaw.browser_download_url
    } : undefined;

    return {
      hasUpdate,
      currentVersion,
      latestVersion: cleanTag,
      releaseName: release.name || latestTag,
      releaseNotes: release.body || '',
      publishedAt: release.published_at || '',
      downloadUrl: setupAsset?.browser_download_url || release.html_url,
      setupAsset,
      portableAsset
    };
  } catch (err) {
    console.warn('Update check failed:', err);
    return null;
  }
}
