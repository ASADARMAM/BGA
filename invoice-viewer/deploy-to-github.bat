@echo off
echo ===================================================
echo WeCloud Invoice Viewer - GitHub Pages Deployment
echo ===================================================
echo.

REM Check if git is installed
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Git is not installed or not in your PATH.
    echo Please install Git or use the manual GitHub web interface method.
    echo See UPDATE-INSTRUCTIONS.md for details.
    pause
    exit /b 1
)

echo Git is installed. Proceeding with deployment...
echo.

REM Ask for GitHub repository path
set /p REPO_PATH="Enter the path to your wecloud-invoices repository (or press Enter to use current directory): "

REM If no path is provided, use current directory
if "%REPO_PATH%"=="" set REPO_PATH=.

REM Change to the repository directory
if not "%REPO_PATH%"=="." (
    cd /d "%REPO_PATH%" 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Could not change to directory %REPO_PATH%
        pause
        exit /b 1
    )
)

echo.
echo Checking if this is a git repository...
if not exist .git (
    echo ERROR: This directory is not a git repository.
    echo Please make sure you're in the correct directory.
    pause
    exit /b 1
)

echo.
echo Pulling latest changes from remote repository...
git pull
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Could not pull latest changes. Continuing anyway...
)

echo.
echo Copying updated view.html file...
copy /y "%~dp0view.html" view.html
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Could not copy view.html file.
    pause
    exit /b 1
)

echo.
echo Adding files to git...
git add view.html
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Could not add files to git.
    pause
    exit /b 1
)

echo.
echo Committing changes...
git commit -m "Fix invoice date display with multiple fallbacks"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Could not commit changes.
    pause
    exit /b 1
)

echo.
echo Pushing changes to GitHub...
git push
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Could not push changes to GitHub.
    echo Please check your internet connection and GitHub credentials.
    pause
    exit /b 1
)

echo.
echo ===================================================
echo Deployment completed successfully!
echo.
echo Your changes will be live on GitHub Pages in a few minutes.
echo.
echo Remember to clear your browser cache or use incognito mode
echo to see the changes.
echo ===================================================
pause 