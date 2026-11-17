@echo off
chcp 65001 >nul
setlocal

set "TMPDIR=_pack_tmp"

if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"
mkdir "%TMPDIR%"

powershell -NoProfile -Command "((Get-Content -Raw manifest.json | ConvertFrom-Json).version) | Set-Content -Encoding ascii '%TMPDIR%\version.txt'"
set /p VERSION=<"%TMPDIR%\version.txt"

if not defined VERSION (
    echo 未能读取 manifest.json 中的版本号，打包终止。
    echo.
    pause
    exit /b 1
)

set "OUTPUT=htmlprint-v%VERSION%.zip"

echo 正在打包 网页打印助手 v%VERSION% ...
echo.

if exist "%OUTPUT%" del "%OUTPUT%"

mkdir "%TMPDIR%\icons"

copy /y manifest.json "%TMPDIR%\" >nul
copy /y background.js "%TMPDIR%\" >nul
copy /y content.js "%TMPDIR%\" >nul
copy /y icons\icon16.png "%TMPDIR%\icons\" >nul
copy /y icons\icon32.png "%TMPDIR%\icons\" >nul
copy /y icons\icon48.png "%TMPDIR%\icons\" >nul
copy /y icons\icon128.png "%TMPDIR%\icons\" >nul

powershell -NoProfile -Command "Compress-Archive -Path '%TMPDIR%\*' -DestinationPath '%OUTPUT%' -Force"

rmdir /s /q "%TMPDIR%"

if exist "%OUTPUT%" (
    echo 打包完成: %OUTPUT%
    for %%A in ("%OUTPUT%") do echo 文件大小: %%~zA 字节
) else (
    echo 打包失败！
)

echo.
pause