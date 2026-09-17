; Script Inno Setup para o CPROEIS Automacao
; Compila com: ISCC.exe instalador_inno.iss
; Fonte: dist_instalador\win-unpacked (gerado pelo electron-builder)

#define MyAppName "CPROEIS Automacao"
#define MyAppVersion "1.2.0"
#define MyAppPublisher "CPROEIS"
#define MyAppExeName "CPROEIS Automacao.exe"

[Setup]
AppId={{B4E8C1A2-7F3D-4E9A-B5C6-8D2F1A3E7B90}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\CPROEIS Automacao
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; instala para o usuario atual, sem pedir administrador
PrivilegesRequired=lowest
OutputDir=dist_inno
OutputBaseFilename=CPROEIS_Automacao_Setup_{#MyAppVersion}
SetupIconFile=frontend\electron\icon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; permite escolher onde salvar/instalar
DisableDirPage=no
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na area de trabalho"; GroupDescription: "Atalhos adicionais:"

[Files]
; copia todo o conteudo do build do electron-builder
Source: "dist_instalador\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir o {#MyAppName}"; Flags: nowait postinstall skipifsilent

[InstallDelete]
; remove restos de builds antigos (pasta app do tempo em que asar era false)
Type: filesandordirs; Name: "{app}\resources\app"
Type: filesandordirs; Name: "{app}\resources\app.bak-desativado"
