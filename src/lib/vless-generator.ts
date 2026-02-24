// VLESS Config Generator Library
// Generates VLESS URI, Xray JSON, and Sing-box JSON configurations

export interface VlessConfig {
  // Basic Settings
  uuid: string;
  serverAddress: string;
  port: number;
  protocol: 'vless';
  name?: string;
  
  // Security Mode
  securityMode: 'reality' | 'tls';
  sni: string;
  
  // Reality Settings
  realityPublicKey?: string;
  realityShortId?: string;
  realitySpiderX?: string;
  
  // Cosmetic Settings
  mtu: 'default' | '1280' | '1350' | '1400' | '1500';
  
  // Fragmentation
  fragmentationEnabled: boolean;
  fragmentationPackets: '1-1' | '1-2' | '1-3' | 'tlshello';
  fragmentationLength: string;
  
  // Noise/Dummy Traffic
  noiseEnabled: boolean;
  noiseType: 'base64' | 'random' | 'str';
  noisePacketCount: string;
  
  // Socket Options
  tcpFastOpen: boolean;
  tcpKeepAlive: boolean;
  tcpKeepAliveInterval: number;
  tcpNoDelay: boolean;
  
  // Flow Control
  flow: 'none' | 'xtls-rprx-vision' | 'xtls-rprx-vision-udp443';
}

export const defaultConfig: VlessConfig = {
  uuid: '',
  serverAddress: '',
  port: 443,
  protocol: 'vless',
  name: '',
  securityMode: 'reality',
  sni: '',
  realityPublicKey: '',
  realityShortId: '',
  realitySpiderX: '',
  mtu: 'default',
  fragmentationEnabled: false,
  fragmentationPackets: '1-1',
  fragmentationLength: '40-60',
  noiseEnabled: false,
  noiseType: 'base64',
  noisePacketCount: '5-10',
  tcpFastOpen: false,
  tcpKeepAlive: false,
  tcpKeepAliveInterval: 30,
  tcpNoDelay: false,
  flow: 'none',
};

// Generate a random UUID v4
export function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Parse VLESS URI to config
export function parseVlessUri(uri: string): VlessConfig | null {
  try {
    // Handle vless:// prefix
    if (!uri.startsWith('vless://')) {
      return null;
    }
    
    // Extract UUID
    const uuidMatch = uri.match(/vless:\/\/([a-f0-9-]{36})@/i);
    if (!uuidMatch) return null;
    const uuid = uuidMatch[1];
    
    // Extract server and port
    const serverMatch = uri.match(/@([^:]+):(\d+)/);
    if (!serverMatch) return null;
    const serverAddress = serverMatch[1];
    const port = parseInt(serverMatch[2]);
    
    // Parse query parameters
    const queryStart = uri.indexOf('?');
    const hashStart = uri.indexOf('#');
    const queryEnd = hashStart > -1 ? hashStart : uri.length;
    
    let params: URLSearchParams;
    if (queryStart > -1) {
      params = new URLSearchParams(uri.substring(queryStart + 1, queryEnd));
    } else {
      params = new URLSearchParams();
    }
    
    // Extract name from hash
    let name = '';
    if (hashStart > -1) {
      name = decodeURIComponent(uri.substring(hashStart + 1));
    }
    
    // Parse security mode
    const security = params.get('security') || params.get('type');
    const securityMode: 'reality' | 'tls' = security === 'reality' ? 'reality' : 
                                              security === 'tls' ? 'tls' : 'reality';
    
    // Parse flow
    const flowParam = params.get('flow') || '';
    const flow: VlessConfig['flow'] = 
      flowParam === 'xtls-rprx-vision' ? 'xtls-rprx-vision' :
      flowParam === 'xtls-rprx-vision-udp443' ? 'xtls-rprx-vision-udp443' : 'none';
    
    // Parse cosmetic parameters (custom extensions)
    // Parse fragmentation - поддерживаем разные форматы
    let fragmentationEnabled = false;
    let fragmentationPackets: VlessConfig['fragmentationPackets'] = '1-1';
    let fragmentationLength = '40-60';
    
    const fragmentParam = params.get('fragment');
    if (fragmentParam) {
      fragmentationEnabled = true;
      // Формат: "1-1,40-60" или просто "1-1"
      if (fragmentParam.includes(',')) {
        const [packets, length] = fragmentParam.split(',');
        fragmentationPackets = packets as VlessConfig['fragmentationPackets'];
        fragmentationLength = length || '40-60';
      } else if (fragmentParam !== 'true' && fragmentParam !== 'false') {
        fragmentationPackets = fragmentParam as VlessConfig['fragmentationPackets'];
      }
    }
    
    // Альтернативные параметры
    if (params.get('fragmentPackets')) {
      fragmentationEnabled = true;
      fragmentationPackets = params.get('fragmentPackets') as VlessConfig['fragmentationPackets'];
    }
    if (params.get('fragmentLength')) {
      fragmentationLength = params.get('fragmentLength') || '40-60';
    }
    
    // Parse noise
    const noiseEnabled = params.has('noise');
    const noiseParam = params.get('noise') || '';
    let noiseType: VlessConfig['noiseType'] = 'random';
    let noisePacketCount = '5-10';
    if (noiseParam.includes(',')) {
      const [type, count] = noiseParam.split(',');
      noiseType = type as VlessConfig['noiseType'];
      noisePacketCount = count || '5-10';
    }
    
    const mtuParam = params.get('mtu');
    const mtu: VlessConfig['mtu'] = 
      mtuParam === '1280' ? '1280' :
      mtuParam === '1350' ? '1350' :
      mtuParam === '1400' ? '1400' :
      mtuParam === '1500' ? '1500' : 'default';
    
    return {
      ...defaultConfig,
      uuid,
      serverAddress,
      port,
      name,
      securityMode,
      sni: params.get('sni') || '',
      realityPublicKey: params.get('pbk') || '',
      realityShortId: params.get('sid') || '',
      realitySpiderX: params.get('spx') || '',
      flow,
      mtu,
      fragmentationEnabled,
      fragmentationPackets,
      fragmentationLength,
      noiseEnabled,
      noiseType,
      noisePacketCount,
    };
  } catch {
    return null;
  }
}

// Parse multiple VLESS URIs from text (supports base64 encoded content)
export function parseMultipleVlessUris(text: string): VlessConfig[] {
  let content = text.trim();
  
  // Try to decode base64 if content doesn't look like plain URIs
  if (!content.includes('vless://') && !content.includes('vmess://') && !content.includes('trojan://')) {
    try {
      // Remove whitespace and decode base64
      const cleanBase64 = content.replace(/[\r\n\s]/g, '');
      const decoded = atob(cleanBase64);
      // Check if decoded content looks like URIs
      if (decoded.includes('vless://') || decoded.includes('vmess://') || decoded.includes('trojan://')) {
        content = decoded;
      }
    } catch {
      // Not base64, use original content
    }
  }
  
  const lines = content.split(/[\r\n]+/).map(l => l.trim()).filter(l => l);
  const configs: VlessConfig[] = [];
  
  for (const line of lines) {
    // Try to parse as vless URI
    if (line.startsWith('vless://')) {
      const config = parseVlessUri(line);
      if (config) {
        configs.push(config);
      }
    }
  }
  
  return configs;
}

// Generate VLESS URI - standard format (compatible with happ, Karing, Hiddify, etc.)
// This generates a clean VLESS URI without non-standard cosmetic parameters
export function generateVlessUri(config: VlessConfig): string {
  const params = new URLSearchParams();
  
  // Security settings
  params.set('security', config.securityMode);
  params.set('type', 'tcp');
  
  if (config.sni) {
    params.set('sni', config.sni);
  }
  
  if (config.securityMode === 'reality') {
    if (config.realityPublicKey) {
      params.set('pbk', config.realityPublicKey);
    }
    if (config.realityShortId) {
      params.set('sid', config.realityShortId);
    }
    if (config.realitySpiderX) {
      params.set('spx', config.realitySpiderX);
    }
    params.set('fp', 'chrome');
  }
  
  // Flow control
  if (config.flow !== 'none') {
    params.set('flow', config.flow);
  }
  
  // Build name with cosmetic info (in remarks only, not in URI params)
  let remarks = config.name || 'VLESS';
  const cosmetics: string[] = [];
  
  if (config.fragmentationEnabled) {
    cosmetics.push(`frag:${config.fragmentationPackets}`);
  }
  if (config.noiseEnabled) {
    cosmetics.push(`noise:${config.noiseType}`);
  }
  if (config.mtu !== 'default') {
    cosmetics.push(`mtu:${config.mtu}`);
  }
  if (config.flow !== 'none') {
    cosmetics.push(config.flow);
  }
  
  if (cosmetics.length > 0) {
    remarks += ` [${cosmetics.join(', ')}]`;
  }
  
  const uri = `vless://${config.uuid}@${config.serverAddress}:${config.port}?${params.toString()}#${encodeURIComponent(remarks)}`;
  return uri;
}

// Generate VLESS URI with NekoBox/Husi extended format (includes cosmetic params)
// Only use this for NekoBox, Husi, v2rayNG which support these extensions
export function generateVlessUriExtended(config: VlessConfig): string {
  const params = new URLSearchParams();
  
  // Security settings
  params.set('security', config.securityMode);
  params.set('type', 'tcp');
  
  if (config.sni) {
    params.set('sni', config.sni);
  }
  
  if (config.securityMode === 'reality') {
    if (config.realityPublicKey) {
      params.set('pbk', config.realityPublicKey);
    }
    if (config.realityShortId) {
      params.set('sid', config.realityShortId);
    }
    if (config.realitySpiderX) {
      params.set('spx', config.realitySpiderX);
    }
    params.set('fp', 'chrome');
  }
  
  // Flow control
  if (config.flow !== 'none') {
    params.set('flow', config.flow);
  }
  
  // Cosmetic settings - NekoBox/Husi extended format
  if (config.fragmentationEnabled) {
    // NekoBox format: fragment=packets,length
    params.set('fragment', `${config.fragmentationPackets},${config.fragmentationLength}`);
  }
  
  // Noise settings (NekoBox specific)
  if (config.noiseEnabled) {
    params.set('noise', `${config.noiseType},${config.noisePacketCount}`);
  }
  
  // MTU setting
  if (config.mtu !== 'default') {
    params.set('mtu', config.mtu);
  }
  
  // Build name with cosmetic info
  let remarks = config.name || 'VLESS';
  const cosmetics: string[] = [];
  
  if (config.fragmentationEnabled) {
    cosmetics.push(`frag:${config.fragmentationPackets}`);
  }
  if (config.noiseEnabled) {
    cosmetics.push(`noise:${config.noiseType}`);
  }
  if (config.mtu !== 'default') {
    cosmetics.push(`mtu:${config.mtu}`);
  }
  if (config.flow !== 'none') {
    cosmetics.push(config.flow);
  }
  
  if (cosmetics.length > 0) {
    remarks += ` [${cosmetics.join(', ')}]`;
  }
  
  const uri = `vless://${config.uuid}@${config.serverAddress}:${config.port}?${params.toString()}#${encodeURIComponent(remarks)}`;
  return uri;
}

// Generate Xray JSON Configuration
export function generateXrayConfig(config: VlessConfig): string {
  const xrayConfig: Record<string, unknown> = {
    log: {
      loglevel: 'warning'
    },
    inbounds: [
      {
        tag: 'socks',
        port: 10808,
        listen: '127.0.0.1',
        protocol: 'socks',
        settings: {
          auth: 'noauth',
          udp: true
        }
      },
      {
        tag: 'http',
        port: 10809,
        listen: '127.0.0.1',
        protocol: 'http'
      }
    ],
    outbounds: [
      {
        tag: 'proxy',
        protocol: 'vless',
        settings: {
          vnext: [
            {
              address: config.serverAddress,
              port: config.port,
              users: [
                {
                  id: config.uuid,
                  encryption: 'none',
                  flow: config.flow !== 'none' ? config.flow : undefined
                }
              ]
            }
          ]
        },
        streamSettings: {
          network: 'tcp',
          security: config.securityMode,
          ...(config.securityMode === 'reality' && {
            realitySettings: {
              show: false,
              fingerprint: 'chrome',
              serverName: config.sni,
              publicKey: config.realityPublicKey,
              shortId: config.realityShortId,
              spiderX: config.realitySpiderX
            }
          }),
          ...(config.securityMode === 'tls' && {
            tlsSettings: {
              serverName: config.sni,
              allowInsecure: false,
              fingerprint: 'chrome'
            }
          }),
          ...(config.fragmentationEnabled && {
            sockopt: {
              'dialer-proxy': 'fragment',
              'tcp-keep-alive-interval': config.tcpKeepAlive ? config.tcpKeepAliveInterval : undefined,
              'tcp-fast-open': config.tcpFastOpen,
              'tcp-no-delay': config.tcpNoDelay,
              ...(config.mtu !== 'default' && { mtu: parseInt(config.mtu) })
            }
          })
        }
      }
    ]
  };
  
  // Add fragmentation outbound if enabled
  if (config.fragmentationEnabled) {
    const outbounds = xrayConfig.outbounds as Array<Record<string, unknown>>;
    outbounds.push({
      tag: 'fragment',
      protocol: 'freedom',
      settings: {
        domainStrategy: 'AsIs',
        fragment: {
          packets: config.fragmentationPackets,
          length: config.fragmentationLength
        }
      }
    });
  }
  
  // Add noise outbound if enabled
  if (config.noiseEnabled) {
    const outbounds = xrayConfig.outbounds as Array<Record<string, unknown>>;
    outbounds.push({
      tag: 'noise',
      protocol: 'freedom',
      settings: {
        domainStrategy: 'AsIs',
        noised: {
          type: config.noiseType,
          packet: config.noisePacketCount
        }
      }
    });
  }
  
  // Add DNS rules
  xrayConfig.dns = {
    servers: [
      {
        tag: 'google',
        address: '8.8.8.8'
      },
      {
        tag: 'local',
        address: '223.5.5.5',
        detour: 'direct'
      }
    ],
    rules: [
      {
        type: 'field',
        ip: ['geoip:private'],
        server: 'local'
      }
    ]
  };
  
  // Add routing
  xrayConfig.routing = {
    domainStrategy: 'IPIfNonMatch',
    rules: [
      {
        type: 'field',
        ip: ['geoip:private'],
        outboundTag: 'direct'
      }
    ]
  };
  
  const outbounds = xrayConfig.outbounds as Array<Record<string, unknown>>;
  outbounds.push({ tag: 'direct', protocol: 'freedom' });
  outbounds.push({ tag: 'block', protocol: 'blackhole' });
  
  return JSON.stringify(xrayConfig, null, 2);
}

// Generate Sing-box JSON Configuration
export function generateSingboxConfig(config: VlessConfig): string {
  // Build the VLESS outbound
  const vlessOutbound: Record<string, unknown> = {
    type: 'vless',
    tag: 'proxy',
    server: config.serverAddress,
    server_port: config.port,
    uuid: config.uuid,
    flow: config.flow !== 'none' ? config.flow : undefined,
    transport: {
      type: 'tcp'
    },
    tls: {
      enabled: true,
      server_name: config.sni,
      ...(config.securityMode === 'reality' && {
        reality: {
          enabled: true,
          public_key: config.realityPublicKey,
          short_id: config.realityShortId
        },
        utls: {
          enabled: true,
          fingerprint: 'chrome'
        }
      }),
      ...(config.securityMode === 'tls' && {
        utls: {
          enabled: true,
          fingerprint: 'chrome'
        }
      })
    },
    tcp_fast_open: config.tcpFastOpen,
    tcp_multi_path: false,
    udp_over_tcp: false
  };
  
  const singboxConfig: Record<string, unknown> = {
    log: {
      level: 'warn',
      timestamp: true
    },
    dns: {
      servers: [
        {
          tag: 'google',
          address: '8.8.8.8',
          detour: 'proxy'
        },
        {
          tag: 'local',
          address: '223.5.5.5',
          detour: 'direct'
        }
      ],
      rules: [
        {
          outbound: 'any',
          server: 'local'
        }
      ],
      strategy: 'ipv4_only'
    },
    inbounds: [
      {
        type: 'tun',
        tag: 'tun-in',
        inet4_address: '172.19.0.1/30',
        auto_route: true,
        strict_route: true,
        stack: 'system'
      },
      {
        type: 'socks',
        tag: 'socks-in',
        listen: '127.0.0.1',
        listen_port: 10808
      },
      {
        type: 'http',
        tag: 'http-in',
        listen: '127.0.0.1',
        listen_port: 10809
      }
    ],
    outbounds: [
      vlessOutbound,
      { type: 'direct', tag: 'direct' },
      { type: 'block', tag: 'block' },
      { type: 'dns', tag: 'dns-out' }
    ]
  };
  
  // Note: Sing-box does not support packet fragmentation like Xray-core.
  // Fragmentation settings are stored in remarks but not applied in config.
  // For DPI bypass with Sing-box, consider using XTLS Vision flow or external tools.
  
  // Add routing
  singboxConfig.route = {
    rules: [
      {
        ip_is_private: true,
        outbound: 'direct'
      }
    ],
    final: 'proxy',
    auto_detect_interface: true
  };
  
  return JSON.stringify(singboxConfig, null, 2);
}

// Preset configurations
export const presets = {
  minimal: {
    name: 'Минимальная маскировка',
    description: 'Базовая конфигурация без дополнительной маскировки',
    config: {
      ...defaultConfig,
      fragmentationEnabled: false,
      noiseEnabled: false,
      tcpFastOpen: false,
      tcpKeepAlive: false,
      tcpNoDelay: false,
      flow: 'none' as const,
      mtu: 'default' as const
    }
  },
  maximum: {
    name: 'Максимальный обход',
    description: 'Максимальная маскировка для обхода строгой цензуры',
    config: {
      ...defaultConfig,
      fragmentationEnabled: true,
      fragmentationPackets: 'tlshello' as const,
      fragmentationLength: '40-60',
      noiseEnabled: true,
      noiseType: 'random' as const,
      noisePacketCount: '5-10',
      tcpFastOpen: true,
      tcpKeepAlive: true,
      tcpKeepAliveInterval: 30,
      tcpNoDelay: true,
      flow: 'xtls-rprx-vision' as const,
      mtu: '1350' as const
    }
  },
  mobile: {
    name: 'Для мобильных сетей',
    description: 'Оптимизировано для мобильных операторов',
    config: {
      ...defaultConfig,
      fragmentationEnabled: true,
      fragmentationPackets: '1-2' as const,
      fragmentationLength: '50-100',
      noiseEnabled: false,
      tcpFastOpen: true,
      tcpKeepAlive: true,
      tcpKeepAliveInterval: 15,
      tcpNoDelay: true,
      flow: 'none' as const,
      mtu: '1280' as const
    }
  },
  tcpu: {
    name: 'Против ТСПУ',
    description: 'Настройки для обхода ТСПУ (DPI России)',
    config: {
      ...defaultConfig,
      fragmentationEnabled: true,
      fragmentationPackets: '1-3' as const,
      fragmentationLength: '10-20',
      noiseEnabled: true,
      noiseType: 'random' as const,
      noisePacketCount: '3-5',
      tcpFastOpen: true,
      tcpKeepAlive: true,
      tcpKeepAliveInterval: 10,
      tcpNoDelay: true,
      flow: 'xtls-rprx-vision' as const,
      mtu: '1280' as const
    }
  }
};

// Validation helper
export function validateConfig(config: VlessConfig): string[] {
  const errors: string[] = [];
  
  if (!config.uuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config.uuid)) {
    errors.push('Неверный формат UUID');
  }
  
  if (!config.serverAddress) {
    errors.push('Укажите адрес сервера');
  }
  
  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('Порт должен быть от 1 до 65535');
  }
  
  if (config.securityMode === 'reality') {
    if (!config.realityPublicKey) {
      errors.push('Укажите публичный ключ Reality');
    }
    if (!config.sni) {
      errors.push('Укажите SNI для Reality');
    }
  }
  
  if (config.securityMode === 'tls' && !config.sni) {
    errors.push('Укажите SNI для TLS');
  }
  
  return errors;
}

// Apply cosmetic settings to existing config
export function applyCosmeticToConfig(baseConfig: VlessConfig, cosmeticSettings: Partial<VlessConfig>): VlessConfig {
  return {
    ...baseConfig,
    ...cosmeticSettings
  };
}

// Generate Karing JSON Configuration
// Karing uses Clash/Mihomo format
export function generateKaringConfig(config: VlessConfig): string {
  // Build name with cosmetic info
  let remarks = config.name || 'VLESS';
  const cosmetics: string[] = [];
  
  if (config.fragmentationEnabled) {
    cosmetics.push(`frag:${config.fragmentationPackets}`);
  }
  if (config.noiseEnabled) {
    cosmetics.push(`noise:${config.noiseType}`);
  }
  if (config.mtu !== 'default') {
    cosmetics.push(`mtu:${config.mtu}`);
  }
  if (config.flow !== 'none') {
    cosmetics.push(config.flow);
  }
  
  if (cosmetics.length > 0) {
    remarks += ` [${cosmetics.join(', ')}]`;
  }
  
  // Build proxy object - remove undefined values
  const proxy: Record<string, unknown> = {
    name: remarks,
    type: 'vless',
    server: config.serverAddress,
    port: config.port,
    uuid: config.uuid,
    network: 'tcp',
    tls: true,
    'skip-cert-verify': false,
    servername: config.sni,
    'client-fingerprint': 'chrome'
  };
  
  // Add flow only if not 'none'
  if (config.flow !== 'none') {
    proxy.flow = config.flow;
  }
  
  // Add Reality options
  if (config.securityMode === 'reality') {
    proxy['reality-opts'] = {
      'public-key': config.realityPublicKey,
      'short-id': config.realityShortId
    };
  }
  
  const karingConfig = {
    proxies: [proxy],
    'proxy-groups': [
      {
        name: 'PROXY',
        type: 'select',
        proxies: [remarks]
      }
    ],
    rules: [
      'GEOIP,LAN,DIRECT',
      'MATCH,PROXY'
    ]
  };
  
  return JSON.stringify(karingConfig, null, 2);
}

// Generate Hiddify compatible config (single proxy entry)
export function generateHiddifyConfig(config: VlessConfig): string {
  // Hiddify uses standard VLESS URI format
  return generateVlessUri(config);
}

// Export format types
export type ExportFormat = 
  | 'vless-uri'          // Standard VLESS URI (happ, Hiddify, Karing)
  | 'vless-uri-extended' // Extended URI with cosmetic params (NekoBox, Husi, v2rayNG)
  | 'xray-json'          // Xray-core JSON
  | 'singbox-json'       // Sing-box JSON
  | 'karing-json';       // Karing JSON

// Get export for specific format
export function exportConfig(config: VlessConfig, format: ExportFormat): string {
  switch (format) {
    case 'vless-uri':
      return generateVlessUri(config);
    case 'vless-uri-extended':
      return generateVlessUriExtended(config);
    case 'xray-json':
      return generateXrayConfig(config);
    case 'singbox-json':
      return generateSingboxConfig(config);
    case 'karing-json':
      return generateKaringConfig(config);
    default:
      return generateVlessUri(config);
  }
}

// Export multiple configs
export function exportMultipleConfigs(configs: VlessConfig[], format: ExportFormat): string {
  if (format === 'vless-uri' || format === 'vless-uri-extended') {
    const generator = format === 'vless-uri' ? generateVlessUri : generateVlessUriExtended;
    return configs.map(c => generator(c)).join('\n');
  }
  
  // For JSON formats, return array of configs
  if (format === 'karing-json') {
    const proxies = configs.map(config => {
      let remarks = config.name || 'VLESS';
      const cosmetics: string[] = [];
      
      if (config.fragmentationEnabled) {
        cosmetics.push(`frag:${config.fragmentationPackets}`);
      }
      if (config.noiseEnabled) {
        cosmetics.push(`noise:${config.noiseType}`);
      }
      if (config.flow !== 'none') {
        cosmetics.push(config.flow);
      }
      
      if (cosmetics.length > 0) {
        remarks += ` [${cosmetics.join(', ')}]`;
      }
      
      const proxy: Record<string, unknown> = {
        name: remarks,
        type: 'vless',
        server: config.serverAddress,
        port: config.port,
        uuid: config.uuid,
        network: 'tcp',
        tls: true,
        'skip-cert-verify': false,
        servername: config.sni,
        'client-fingerprint': 'chrome'
      };
      
      if (config.flow !== 'none') {
        proxy.flow = config.flow;
      }
      
      if (config.securityMode === 'reality') {
        proxy['reality-opts'] = {
          'public-key': config.realityPublicKey,
          'short-id': config.realityShortId
        };
      }
      
      return proxy;
    });
    
    const karingConfig = {
      proxies: proxies,
      'proxy-groups': [
        {
          name: 'PROXY',
          type: 'select',
          proxies: proxies.map(p => p.name as string)
        }
      ],
      rules: [
        'GEOIP,LAN,DIRECT',
        'MATCH,PROXY'
      ]
    };
    return JSON.stringify(karingConfig, null, 2);
  }
  
  // For other JSON formats, return first config only (single config export)
  if (configs.length > 0) {
    return exportConfig(configs[0], format);
  }
  
  return '';
}
