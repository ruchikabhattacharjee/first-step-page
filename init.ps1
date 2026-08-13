Remove-Item -ErrorAction SilentlyContinue package.json
cmd.exe /c "npx -y create-next-app@latest cashflow-pro --ts --eslint --app --no-tailwind --src-dir --use-npm"
if (Test-Path "cashflow-pro") {
    Move-Item -Path "cashflow-pro\*" -Destination "." -Force
    Move-Item -Path "cashflow-pro\.*" -Destination "." -Force -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force "cashflow-pro"
}
