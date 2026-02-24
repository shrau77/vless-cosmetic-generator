'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { 
  Copy, 
  Check, 
  RefreshCw, 
  HelpCircle, 
  Zap, 
  Shield, 
  Wifi, 
  Settings,
  Sparkles,
  Server,
  Key,
  Network,
  Layers,
  Upload,
  Download,
  Plus,
  Trash2,
  List,
  FileText,
  Link,
  Globe
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  VlessConfig,
  defaultConfig,
  generateUuid,
  generateVlessUri,
  generateVlessUriExtended,
  generateXrayConfig,
  generateSingboxConfig,
  generateKaringConfig,
  exportConfig,
  exportMultipleConfigs,
  ExportFormat,
  parseVlessUri,
  parseMultipleVlessUris,
  presets,
  validateConfig,
  applyCosmeticToConfig
} from '@/lib/vless-generator';

// Тип для ноды в списке
interface NodeItem {
  id: string;
  config: VlessConfig;
  selected: boolean;
  originalUri: string;
}

export default function VlessGeneratorPage() {
  const { toast } = useToast();
  
  // Одиночная нода
  const [config, setConfig] = useState<VlessConfig>({
    ...defaultConfig,
    uuid: generateUuid()
  });
  
  // Массовый режим
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [importText, setImportText] = useState('');
  const [subscriptionUrl, setSubscriptionUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Настройки косметики для массового применения
  const [bulkCosmetic, setBulkCosmetic] = useState({
    fragmentationEnabled: true,
    fragmentationPackets: '1-3' as VlessConfig['fragmentationPackets'],
    fragmentationLength: '10-20',
    noiseEnabled: false,
    noiseType: 'random' as VlessConfig['noiseType'],
    noisePacketCount: '3-5',
    mtu: 'default' as VlessConfig['mtu'],
    tcpFastOpen: true,
    tcpKeepAlive: true,
    tcpNoDelay: true,
  });
  
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('vless-uri');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update config field
  const updateConfig = useCallback(<K extends keyof VlessConfig>(
    key: K,
    value: VlessConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        description: 'Скопировано в буфер обмена',
        
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({
        variant: 'destructive',
        description: 'Ошибка копирования'
      });
    }
  }, [toast]);

  // Apply preset
  const applyPreset = useCallback((presetKey: keyof typeof presets) => {
    const preset = presets[presetKey];
    setConfig(prev => ({
      ...prev,
      ...preset.config
    }));
    toast({
      description: `Применен пресет: ${preset.name}`,
      
    });
  }, [toast]);

  // Импорт нод из текста
  const importFromText = useCallback(() => {
    const configs = parseMultipleVlessUris(importText);
    if (configs.length === 0) {
      toast({
        variant: 'destructive',
        description: 'Не найдено валидных VLESS ссылок'
      });
      return;
    }
    
    const newNodes: NodeItem[] = configs.map((cfg, index) => ({
      id: `import-${Date.now()}-${index}`,
      config: cfg,
      selected: true,
      originalUri: generateVlessUri(cfg)
    }));
    
    setNodes(prev => [...prev, ...newNodes]);
    setImportText('');
    toast({
      description: `Импортировано ${configs.length} нод`
    });
  }, [importText, toast]);

  // Импорт из файла
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const configs = parseMultipleVlessUris(text);
      
      if (configs.length === 0) {
        toast({
          variant: 'destructive',
          description: 'Файл не содержит валидных VLESS ссылок'
        });
        return;
      }
      
      const newNodes: NodeItem[] = configs.map((cfg, index) => ({
        id: `file-${Date.now()}-${index}`,
        config: cfg,
        selected: true,
        originalUri: generateVlessUri(cfg)
      }));
      
      setNodes(prev => [...prev, ...newNodes]);
      toast({
        description: `Импортировано ${configs.length} нод из файла`
      });
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [toast]);

  // Импорт по подписке
  const importFromSubscription = useCallback(async () => {
    if (!subscriptionUrl.trim()) {
      toast({
        variant: 'destructive',
        description: 'Введите URL подписки'
      });
      return;
    }
    
    setIsLoading(true);
    try {
      // Use CORS proxy for static site
      const corsProxy = 'https://api.allorigins.win/raw?url=';
      const response = await fetch(corsProxy + encodeURIComponent(subscriptionUrl));
      
      if (!response.ok) {
        throw new Error('Ошибка загрузки подписки');
      }
      
      const content = await response.text();
      const configs = parseMultipleVlessUris(content);
      
      if (configs.length === 0) {
        throw new Error('Подписка не содержит VLESS ссылок');
      }
      
      const newNodes: NodeItem[] = configs.map((cfg, index) => ({
        id: `sub-${Date.now()}-${index}`,
        config: cfg,
        selected: true,
        originalUri: generateVlessUri(cfg)
      }));
      
      setNodes(prev => [...prev, ...newNodes]);
      setSubscriptionUrl('');
      toast({
        description: `Импортировано ${configs.length} нод из подписки`
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        description: error instanceof Error ? error.message : 'Ошибка загрузки подписки'
      });
    } finally {
      setIsLoading(false);
    }
  }, [subscriptionUrl, toast]);

  // Удалить ноду
  const removeNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
  }, []);

  // Очистить все ноды
  const clearNodes = useCallback(() => {
    setNodes([]);
    toast({
      description: 'Список очищен'
    });
  }, [toast]);

  // Выбрать/снять выбор со всех
  const toggleSelectAll = useCallback((selected: boolean) => {
    setNodes(prev => prev.map(n => ({ ...n, selected })));
  }, []);

  // Применить косметику к выбранным нодам
  const applyBulkCosmetic = useCallback(() => {
    setNodes(prev => prev.map(node => {
      if (!node.selected) return node;
      
      const newConfig = applyCosmeticToConfig(node.config, {
        fragmentationEnabled: bulkCosmetic.fragmentationEnabled,
        fragmentationPackets: bulkCosmetic.fragmentationPackets,
        fragmentationLength: bulkCosmetic.fragmentationLength,
        noiseEnabled: bulkCosmetic.noiseEnabled,
        noiseType: bulkCosmetic.noiseType,
        noisePacketCount: bulkCosmetic.noisePacketCount,
        mtu: bulkCosmetic.mtu,
        tcpFastOpen: bulkCosmetic.tcpFastOpen,
        tcpKeepAlive: bulkCosmetic.tcpKeepAlive,
        tcpNoDelay: bulkCosmetic.tcpNoDelay,
      });
      
      return { ...node, config: newConfig };
    }));
    
    const selectedCount = nodes.filter(n => n.selected).length;
    toast({
      description: `Косметика применена к ${selectedCount} нодам`
    });
  }, [bulkCosmetic, nodes, toast]);

  // Экспорт всех выбранных нод
  const exportSelected = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) {
      toast({
        variant: 'destructive',
        description: 'Нет выбранных нод для экспорта'
      });
      return;
    }
    
    const uris = selectedNodes.map(n => generateVlessUri(n.config)).join('\n');
    copyToClipboard(uris, 'bulk-export');
  }, [nodes, copyToClipboard, toast]);

  // Скачивание файла
  const downloadFile = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) {
      toast({
        variant: 'destructive',
        description: 'Нет выбранных нод для скачивания'
      });
      return;
    }
    
    const uris = selectedNodes.map(n => generateVlessUri(n.config)).join('\n');
    const blob = new Blob([uris], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vless-nodes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      description: `Скачано ${selectedNodes.length} нод`
    });
  }, [nodes, toast]);

  // Validate and get errors
  const errors = validateConfig(config);

  // Generate outputs
  const vlessUri = errors.length === 0 ? generateVlessUri(config) : '';
  const vlessUriExtended = errors.length === 0 ? generateVlessUriExtended(config) : '';
  const xrayConfig = errors.length === 0 ? generateXrayConfig(config) : '';
  const singboxConfig = errors.length === 0 ? generateSingboxConfig(config) : '';
  const karingConfig = errors.length === 0 ? generateKaringConfig(config) : '';


  // Статистика
  const selectedCount = nodes.filter(n => n.selected).length;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        {/* Header */}
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">VLESS Config Generator</h1>
                  <p className="text-sm text-muted-foreground">Генератор конфигураций с обходом DPI</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="hidden sm:flex">
                  <Sparkles className="w-3 h-3 mr-1" />
                  v2.0
                </Badge>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          {/* Mode Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'single' | 'bulk')} className="mb-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="single" className="gap-2">
                <Plus className="w-4 h-4" />
                Одна нода
              </TabsTrigger>
              <TabsTrigger value="bulk" className="gap-2">
                <List className="w-4 h-4" />
                Массовый импорт
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* SINGLE NODE MODE */}
          {activeTab === 'single' && (
            <>
              {/* Preset Buttons */}
              <div className="mb-6">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(presets) as Array<keyof typeof presets>).map(key => (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset(key)}
                      className="gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      {presets[key].name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Left Panel - Form */}
                <div className="space-y-4">
                  {/* Basic Settings */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Server className="w-4 h-4" />
                        Основные настройки
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* UUID */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="uuid">UUID</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Уникальный идентификатор пользователя. Нажмите кнопку для генерации.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            id="uuid"
                            value={config.uuid}
                            onChange={e => updateConfig('uuid', e.target.value)}
                            placeholder="xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
                            className="font-mono text-sm"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateConfig('uuid', generateUuid())}
                            title="Сгенерировать UUID"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Server Address */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="server">Адрес сервера</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Домен или IP-адрес вашего VLESS сервера</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="server"
                          value={config.serverAddress}
                          onChange={e => updateConfig('serverAddress', e.target.value)}
                          placeholder="example.com или 192.168.1.1"
                        />
                      </div>

                      {/* Port */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="port">Порт</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Порт сервера (обычно 443 для HTTPS)</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="port"
                          type="number"
                          value={config.port}
                          onChange={e => updateConfig('port', parseInt(e.target.value) || 443)}
                          min={1}
                          max={65535}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Security Mode */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Key className="w-4 h-4" />
                        Режим безопасности
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Security Mode */}
                      <div className="space-y-2">
                        <Label>Тип безопасности</Label>
                        <div className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="reality"
                              name="security"
                              checked={config.securityMode === 'reality'}
                              onChange={() => updateConfig('securityMode', 'reality')}
                              className="accent-primary"
                            />
                            <Label htmlFor="reality" className="cursor-pointer">Reality</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="tls"
                              name="security"
                              checked={config.securityMode === 'tls'}
                              onChange={() => updateConfig('securityMode', 'tls')}
                              className="accent-primary"
                            />
                            <Label htmlFor="tls" className="cursor-pointer">TLS</Label>
                          </div>
                        </div>
                      </div>

                      {/* SNI */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="sni">SNI</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Имя сервера для TLS handshake. Для Reality укажите домен, который имитируется.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          id="sni"
                          value={config.sni}
                          onChange={e => updateConfig('sni', e.target.value)}
                          placeholder="www.google.com"
                        />
                      </div>

                      {/* Reality Settings */}
                      {config.securityMode === 'reality' && (
                        <div className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="publicKey">Публичный ключ</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Reality публичный ключ с сервера</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Input
                              id="publicKey"
                              value={config.realityPublicKey}
                              onChange={e => updateConfig('realityPublicKey', e.target.value)}
                              placeholder="base64 encoded key"
                              className="font-mono text-sm"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="shortId">Short ID</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Короткий идентификатор для Reality</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Input
                              id="shortId"
                              value={config.realityShortId}
                              onChange={e => updateConfig('realityShortId', e.target.value)}
                              placeholder="hex string"
                              className="font-mono text-sm"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="spiderX">Spider X</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">Путь для Spider X (опционально)</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Input
                              id="spiderX"
                              value={config.realitySpiderX}
                              onChange={e => updateConfig('realitySpiderX', e.target.value)}
                              placeholder="/"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Flow Control */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Layers className="w-4 h-4" />
                        Контроль потока
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>Flow</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Режим управления потоком XTLS. Vision обеспечивает лучшую маскировку.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Select
                          value={config.flow}
                          onValueChange={value => updateConfig('flow', value as VlessConfig['flow'])}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">none (без XTLS)</SelectItem>
                            <SelectItem value="xtls-rprx-vision">xtls-rprx-vision</SelectItem>
                            <SelectItem value="xtls-rprx-vision-udp443">xtls-rprx-vision-udp443</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Cosmetic Settings */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Settings className="w-4 h-4" />
                        Косметические настройки
                      </CardTitle>
                      <CardDescription>
                        Настройки для обхода DPI и маскировки трафика
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* MTU */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label>MTU</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Меньше MTU = меньше фрагментация, но больше оверхед</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Select
                          value={config.mtu}
                          onValueChange={value => updateConfig('mtu', value as VlessConfig['mtu'])}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">По умолчанию</SelectItem>
                            <SelectItem value="1280">1280</SelectItem>
                            <SelectItem value="1350">1350</SelectItem>
                            <SelectItem value="1400">1400</SelectItem>
                            <SelectItem value="1500">1500</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      {/* Fragmentation */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Label>Фрагментация</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Разделяет пакеты для обхода DPI-фильтров</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Switch
                            checked={config.fragmentationEnabled}
                            onCheckedChange={checked => updateConfig('fragmentationEnabled', checked)}
                          />
                        </div>
                        
                        {config.fragmentationEnabled && (
                          <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-primary/20">
                            <div className="space-y-2">
                              <Label className="text-sm text-muted-foreground">Пакеты</Label>
                              <Select
                                value={config.fragmentationPackets}
                                onValueChange={value => updateConfig('fragmentationPackets', value as VlessConfig['fragmentationPackets'])}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="1-1">1-1</SelectItem>
                                  <SelectItem value="1-2">1-2</SelectItem>
                                  <SelectItem value="1-3">1-3</SelectItem>
                                  <SelectItem value="tlshello">tlshello</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm text-muted-foreground">Длина</Label>
                              <Input
                                value={config.fragmentationLength}
                                onChange={e => updateConfig('fragmentationLength', e.target.value)}
                                placeholder="40-60"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Noise */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Label>Шум / Фиктивный трафик</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Добавляет шум для маскировки паттернов трафика</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Switch
                            checked={config.noiseEnabled}
                            onCheckedChange={checked => updateConfig('noiseEnabled', checked)}
                          />
                        </div>
                        
                        {config.noiseEnabled && (
                          <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-primary/20">
                            <div className="space-y-2">
                              <Label className="text-sm text-muted-foreground">Тип</Label>
                              <Select
                                value={config.noiseType}
                                onValueChange={value => updateConfig('noiseType', value as VlessConfig['noiseType'])}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="base64">base64</SelectItem>
                                  <SelectItem value="random">random</SelectItem>
                                  <SelectItem value="str">str</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm text-muted-foreground">Кол-во пакетов</Label>
                              <Input
                                value={config.noisePacketCount}
                                onChange={e => updateConfig('noisePacketCount', e.target.value)}
                                placeholder="5-10"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Socket Options */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Network className="w-4 h-4" />
                        Параметры сокета
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="tcpFastOpen"
                            checked={config.tcpFastOpen}
                            onCheckedChange={checked => updateConfig('tcpFastOpen', !!checked)}
                          />
                          <div className="flex items-center gap-1">
                            <Label htmlFor="tcpFastOpen" className="cursor-pointer">TCP Fast Open</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Ускоряет установление TCP-соединений</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="tcpNoDelay"
                            checked={config.tcpNoDelay}
                            onCheckedChange={checked => updateConfig('tcpNoDelay', !!checked)}
                          />
                          <div className="flex items-center gap-1">
                            <Label htmlFor="tcpNoDelay" className="cursor-pointer">TCP No Delay</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Отключает алгоритм Нагла для меньшей задержки</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="tcpKeepAlive"
                            checked={config.tcpKeepAlive}
                            onCheckedChange={checked => updateConfig('tcpKeepAlive', !!checked)}
                          />
                          <div className="flex items-center gap-1">
                            <Label htmlFor="tcpKeepAlive" className="cursor-pointer">TCP Keep Alive</Label>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Поддерживает соединение активным</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        {config.tcpKeepAlive && (
                          <div className="pl-6">
                            <Label className="text-sm text-muted-foreground">Интервал (сек)</Label>
                            <Input
                              type="number"
                              value={config.tcpKeepAliveInterval}
                              onChange={e => updateConfig('tcpKeepAliveInterval', parseInt(e.target.value) || 30)}
                              min={5}
                              max={300}
                              className="mt-1"
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Panel - Output */}
                <div className="space-y-4">
                  {/* Validation Errors */}
                  {errors.length > 0 && (
                    <Card className="border-destructive/50 bg-destructive/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-destructive text-sm">Ошибки конфигурации</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="list-disc list-inside text-sm text-destructive space-y-1">
                          {errors.map((error, i) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Output Tabs */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Wifi className="w-4 h-4" />
                        Сгенерированные конфигурации
                      </CardTitle>
                      <CardDescription>
                        Скопируйте конфигурацию для использования в клиенте
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="vless" className="w-full">
                        <TabsList className="w-full grid grid-cols-5">
                          <TabsTrigger value="vless">VLESS URI</TabsTrigger>
                          <TabsTrigger value="vless-ext">NekoBox</TabsTrigger>
                          <TabsTrigger value="xray">Xray</TabsTrigger>
                          <TabsTrigger value="singbox">Sing-box</TabsTrigger>
                          <TabsTrigger value="karing">Karing</TabsTrigger>
                        </TabsList>

                        <TabsContent value="vless" className="mt-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm text-muted-foreground">VLESS ссылка (happ, Hiddify, Karing, v2rayNG)</Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(vlessUri, 'vless')}
                                disabled={errors.length > 0}
                                className="gap-1"
                              >
                                {copiedField === 'vless' ? (
                                  <>
                                    <Check className="w-4 h-4 text-green-500" />
                                    Скопировано
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4" />
                                    Копировать
                                  </>
                                )}
                              </Button>
                            </div>
                            <ScrollArea className="h-32 rounded-md border bg-muted/50 p-3">
                              <pre className="text-xs font-mono break-all whitespace-pre-wrap">
                                {vlessUri || 'Заполните все обязательные поля...'}
                              </pre>
                            </ScrollArea>
                          </div>
                        </TabsContent>

                        <TabsContent value="xray" className="mt-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm text-muted-foreground">Конфигурация Xray-core</Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(xrayConfig, 'xray')}
                                disabled={errors.length > 0}
                                className="gap-1"
                              >
                                {copiedField === 'xray' ? (
                                  <>
                                    <Check className="w-4 h-4 text-green-500" />
                                    Скопировано
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4" />
                                    Копировать
                                  </>
                                )}
                              </Button>
                            </div>
                            <ScrollArea className="h-64 rounded-md border bg-muted/50 p-3">
                              <pre className="text-xs font-mono whitespace-pre-wrap">
                                {xrayConfig || 'Заполните все обязательные поля...'}
                              </pre>
                            </ScrollArea>
                          </div>
                        </TabsContent>

                        <TabsContent value="singbox" className="mt-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm text-muted-foreground">Конфигурация Sing-box</Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(singboxConfig, 'singbox')}
                                disabled={errors.length > 0}
                                className="gap-1"
                              >
                                {copiedField === 'singbox' ? (
                                  <>
                                    <Check className="w-4 h-4 text-green-500" />
                                    Скопировано
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4" />
                                    Копировать
                                  </>
                                )}
                              </Button>
                            </div>
                            <ScrollArea className="h-64 rounded-md border bg-muted/50 p-3">
                              <pre className="text-xs font-mono whitespace-pre-wrap">
                                {singboxConfig || 'Заполните все обязательные поля...'}
                              </pre>
                            </ScrollArea>
                          </div>
                        </TabsContent>

                        <TabsContent value="vless-ext" className="mt-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm text-muted-foreground">VLESS с косметикой (NekoBox, Husi)</Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(vlessUriExtended, 'vless-ext')}
                                disabled={errors.length > 0}
                                className="gap-1"
                              >
                                {copiedField === 'vless-ext' ? (
                                  <>
                                    <Check className="w-4 h-4 text-green-500" />
                                    Скопировано
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4" />
                                    Копировать
                                  </>
                                )}
                              </Button>
                            </div>
                            <ScrollArea className="h-32 rounded-md border bg-muted/50 p-3">
                              <pre className="text-xs font-mono break-all whitespace-pre-wrap">
                                {vlessUriExtended || 'Заполните все обязательные поля...'}
                              </pre>
                            </ScrollArea>
                            <p className="text-xs text-muted-foreground">⚠️ Только для NekoBox, Husi - содержит расширенные параметры фрагментации</p>
                          </div>
                        </TabsContent>

                        <TabsContent value="karing" className="mt-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm text-muted-foreground">Конфигурация Karing</Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(karingConfig, 'karing')}
                                disabled={errors.length > 0}
                                className="gap-1"
                              >
                                {copiedField === 'karing' ? (
                                  <>
                                    <Check className="w-4 h-4 text-green-500" />
                                    Скопировано
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4" />
                                    Копировать
                                  </>
                                )}
                              </Button>
                            </div>
                            <ScrollArea className="h-64 rounded-md border bg-muted/50 p-3">
                              <pre className="text-xs font-mono whitespace-pre-wrap">
                                {karingConfig || 'Заполните все обязательные поля...'}
                              </pre>
                            </ScrollArea>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>

                  {/* Quick Tips */}
                  <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        Подсказки
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                      <p>• <strong>Reality</strong> — наиболее безопасный режим, имитирует TLS handshake реального сайта</p>
                      <p>• <strong>Фрагментация</strong> — эффективна против DPI, но может увеличить задержку</p>
                      <p>• <strong>xtls-rprx-vision</strong> — обеспечивает лучшую производительность при использовании Reality</p>
                      <p>• <strong>MTU 1280</strong> — оптимален для мобильных сетей с VPN</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}

          {/* BULK MODE */}
          {activeTab === 'bulk' && (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left - Import */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Upload className="w-4 h-4" />
                      Импорт нод
                    </CardTitle>
                    <CardDescription>
                      Загрузите существующие VLESS ноды для модификации
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Text Import */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Из текста
                      </Label>
                      <Textarea
                        value={importText}
                        onChange={e => setImportText(e.target.value)}
                        placeholder="Вставьте vless:// ссылки (по одной на строку)..."
                        className="h-32 font-mono text-xs"
                      />
                      <Button onClick={importFromText} className="w-full" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Импортировать
                      </Button>
                    </div>

                    <Separator />

                    {/* File Import */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Из файла
                      </Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.conf"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        className="w-full" 
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Выбрать файл
                      </Button>
                    </div>

                    <Separator />

                    {/* Subscription Import */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        По подписке
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={subscriptionUrl}
                          onChange={e => setSubscriptionUrl(e.target.value)}
                          placeholder="https://..."
                          className="flex-1"
                        />
                      </div>
                      <Button 
                        onClick={importFromSubscription} 
                        className="w-full" 
                        size="sm"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Link className="w-4 h-4 mr-2" />
                        )}
                        Загрузить
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Cosmetic Presets for Bulk */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Zap className="w-4 h-4" />
                      Быстрые пресеты
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      size="sm"
                      onClick={() => {
                        setBulkCosmetic({
                          fragmentationEnabled: true,
                          fragmentationPackets: '1-3',
                          fragmentationLength: '10-20',
                          noiseEnabled: true,
                          noiseType: 'random',
                          noisePacketCount: '3-5',
                          mtu: '1280',
                          tcpFastOpen: true,
                          tcpKeepAlive: true,
                          tcpNoDelay: true,
                        });
                      }}
                    >
                      🛡️ Против ТСПУ
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      size="sm"
                      onClick={() => {
                        setBulkCosmetic({
                          fragmentationEnabled: true,
                          fragmentationPackets: 'tlshello',
                          fragmentationLength: '40-60',
                          noiseEnabled: false,
                          noiseType: 'random',
                          noisePacketCount: '5-10',
                          mtu: 'default',
                          tcpFastOpen: true,
                          tcpKeepAlive: false,
                          tcpNoDelay: true,
                        });
                      }}
                    >
                      🚀 Максимальный обход
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      size="sm"
                      onClick={() => {
                        setBulkCosmetic({
                          fragmentationEnabled: true,
                          fragmentationPackets: '1-2',
                          fragmentationLength: '50-100',
                          noiseEnabled: false,
                          noiseType: 'random',
                          noisePacketCount: '5-10',
                          mtu: '1280',
                          tcpFastOpen: true,
                          tcpKeepAlive: true,
                          tcpNoDelay: true,
                        });
                      }}
                    >
                      📱 Для мобильных
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Center - Cosmetic Settings */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Settings className="w-4 h-4" />
                      Настройки косметики
                    </CardTitle>
                    <CardDescription>
                      Применяются ко всем выбранным нодам
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Fragmentation */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Фрагментация</Label>
                        <Switch
                          checked={bulkCosmetic.fragmentationEnabled}
                          onCheckedChange={checked => setBulkCosmetic(prev => ({ ...prev, fragmentationEnabled: checked }))}
                        />
                      </div>
                      {bulkCosmetic.fragmentationEnabled && (
                        <div className="grid grid-cols-2 gap-2 pl-4 border-l-2 border-primary/20">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Пакеты</Label>
                            <Select
                              value={bulkCosmetic.fragmentationPackets}
                              onValueChange={value => setBulkCosmetic(prev => ({ ...prev, fragmentationPackets: value as VlessConfig['fragmentationPackets'] }))}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1-1">1-1</SelectItem>
                                <SelectItem value="1-2">1-2</SelectItem>
                                <SelectItem value="1-3">1-3</SelectItem>
                                <SelectItem value="tlshello">tlshello</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Длина</Label>
                            <Input
                              value={bulkCosmetic.fragmentationLength}
                              onChange={e => setBulkCosmetic(prev => ({ ...prev, fragmentationLength: e.target.value }))}
                              className="h-8"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Noise */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Шум</Label>
                        <Switch
                          checked={bulkCosmetic.noiseEnabled}
                          onCheckedChange={checked => setBulkCosmetic(prev => ({ ...prev, noiseEnabled: checked }))}
                        />
                      </div>
                      {bulkCosmetic.noiseEnabled && (
                        <div className="grid grid-cols-2 gap-2 pl-4 border-l-2 border-primary/20">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Тип</Label>
                            <Select
                              value={bulkCosmetic.noiseType}
                              onValueChange={value => setBulkCosmetic(prev => ({ ...prev, noiseType: value as VlessConfig['noiseType'] }))}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="random">random</SelectItem>
                                <SelectItem value="base64">base64</SelectItem>
                                <SelectItem value="str">str</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Пакеты</Label>
                            <Input
                              value={bulkCosmetic.noisePacketCount}
                              onChange={e => setBulkCosmetic(prev => ({ ...prev, noisePacketCount: e.target.value }))}
                              className="h-8"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* MTU */}
                    <div className="space-y-2">
                      <Label>MTU</Label>
                      <Select
                        value={bulkCosmetic.mtu}
                        onValueChange={value => setBulkCosmetic(prev => ({ ...prev, mtu: value as VlessConfig['mtu'] }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">По умолчанию</SelectItem>
                          <SelectItem value="1280">1280</SelectItem>
                          <SelectItem value="1350">1350</SelectItem>
                          <SelectItem value="1400">1400</SelectItem>
                          <SelectItem value="1500">1500</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    {/* Socket Options */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="bulk-tcpFastOpen"
                          checked={bulkCosmetic.tcpFastOpen}
                          onCheckedChange={checked => setBulkCosmetic(prev => ({ ...prev, tcpFastOpen: !!checked }))}
                        />
                        <Label htmlFor="bulk-tcpFastOpen" className="cursor-pointer text-sm">TCP Fast Open</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="bulk-tcpKeepAlive"
                          checked={bulkCosmetic.tcpKeepAlive}
                          onCheckedChange={checked => setBulkCosmetic(prev => ({ ...prev, tcpKeepAlive: !!checked }))}
                        />
                        <Label htmlFor="bulk-tcpKeepAlive" className="cursor-pointer text-sm">TCP Keep Alive</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="bulk-tcpNoDelay"
                          checked={bulkCosmetic.tcpNoDelay}
                          onCheckedChange={checked => setBulkCosmetic(prev => ({ ...prev, tcpNoDelay: !!checked }))}
                        />
                        <Label htmlFor="bulk-tcpNoDelay" className="cursor-pointer text-sm">TCP No Delay</Label>
                      </div>
                    </div>

                    <Button onClick={applyBulkCosmetic} className="w-full">
                      <Zap className="w-4 h-4 mr-2" />
                      Применить к выбранным
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right - Node List */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <List className="w-4 h-4" />
                        Ноды ({nodes.length})
                      </CardTitle>
                      {nodes.length > 0 && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => toggleSelectAll(true)}>
                            Все
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => toggleSelectAll(false)}>
                            Никто
                          </Button>
                          <Button variant="ghost" size="sm" onClick={clearNodes}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {selectedCount > 0 && (
                      <Badge variant="secondary">
                        Выбрано: {selectedCount}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent>
                    {nodes.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Server className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Импортируйте ноды для редактирования</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-2 pr-2">
                          {nodes.map(node => (
                            <div 
                              key={node.id}
                              className={`p-3 rounded-lg border transition-colors ${
                                node.selected ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <Checkbox
                                  checked={node.selected}
                                  onCheckedChange={checked => {
                                    setNodes(prev => prev.map(n => 
                                      n.id === node.id ? { ...n, selected: !!checked } : n
                                    ));
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">
                                    {node.config.name || node.config.serverAddress}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {node.config.serverAddress}:{node.config.port}
                                  </div>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    <Badge variant="outline" className="text-[10px] px-1">
                                      {node.config.securityMode}
                                    </Badge>
                                    {node.config.fragmentationEnabled && (
                                      <Badge variant="outline" className="text-[10px] px-1 text-green-500">
                                        frag:{node.config.fragmentationPackets}
                                      </Badge>
                                    )}
                                    {node.config.flow !== 'none' && (
                                      <Badge variant="outline" className="text-[10px] px-1 text-blue-500">
                                        vision
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => removeNode(node.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>

                {/* Export */}
                {nodes.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Download className="w-4 h-4" />
                        Экспорт
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Format Selection */}
                      <div className="space-y-2">
                        <Label className="text-sm">Формат экспорта</Label>
                        <Select
                          value={exportFormat}
                          onValueChange={value => setExportFormat(value as ExportFormat)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vless-uri">VLESS URI (happ, Hiddify, Karing)</SelectItem>
                            <SelectItem value="vless-uri-extended">NekoBox/Husi (с косметикой)</SelectItem>
                            <SelectItem value="karing-json">Karing JSON</SelectItem>
                            <SelectItem value="xray-json">Xray JSON</SelectItem>
                            <SelectItem value="singbox-json">Sing-box JSON</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Button 
                        onClick={() => {
                          const selectedNodes = nodes.filter(n => n.selected);
                          if (selectedNodes.length === 0) {
                            toast({ variant: 'destructive', description: 'Нет выбранных нод' });
                            return;
                          }
                          const output = exportMultipleConfigs(
                            selectedNodes.map(n => n.config), 
                            exportFormat
                          );
                          copyToClipboard(output, 'bulk-export');
                        }} 
                        variant="default" 
                        className="w-full"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Копировать {selectedCount} ссылок
                      </Button>
                      <Button 
                        onClick={() => {
                          const selectedNodes = nodes.filter(n => n.selected);
                          if (selectedNodes.length === 0) {
                            toast({ variant: 'destructive', description: 'Нет выбранных нод' });
                            return;
                          }
                          const output = exportMultipleConfigs(
                            selectedNodes.map(n => n.config), 
                            exportFormat
                          );
                          const ext = exportFormat.includes('json') ? 'json' : 'txt';
                          const blob = new Blob([output], { type: ext === 'json' ? 'application/json' : 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `vless-nodes-${Date.now()}.${ext}`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast({ description: `Скачано ${selectedNodes.length} нод` });
                        }} 
                        variant="outline" 
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Скачать файл
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border/50 mt-12 py-6">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>VLESS Config Generator — Генератор конфигураций с косметическими настройками</p>
            <p className="mt-1">Поддержка: Reality, TLS, фрагментация, маскировка трафика</p>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
