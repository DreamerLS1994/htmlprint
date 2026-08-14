@echo off
chcp 65001 >nul
setlocal

set "OUTPUT=htmlprint-v1.0.0.zip"
set "TMPDIR=_pack_tmp"

echo 正在打包 网页打印助手 ...
echo.

if exist "%OUTPUT%" del "%OUTPUT%"
if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"

mkdir "%TMPDIR%"
mkdir "%TMPDIR%\libs"

copy /y manifest.json "%TMPDIR%\" >nul
copy /y background.js "%TMPDIR%\" >nul
copy /y content.js "%TMPDIR%\" >nul
copy /y logo.png "%TMPDIR%\" >nul
copy /y libs\Readability.js "%TMPDIR%\libs\" >nul

powershell -Command "Compress-Archive -Path '%TMPDIR%\*' -DestinationPath '%OUTPUT%' -Force"

rmdir /s /q "%TMPDIR%"

if exist "%OUTPUT%" (
    echo 打包完成: %OUTPUT%
    for %%A in ("%OUTPUT%") do echo 文件大小: %%~zA 字节
) else (
    echo 打包失败！
)

echo.
pause
