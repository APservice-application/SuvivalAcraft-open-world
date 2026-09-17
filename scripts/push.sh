#!/usr/bin/env bash
# push ทนทาน: ซ่อม remote/identity ที่ sandbox ตัดทิ้ง แล้ว push
cd "$(dirname "$0")/.."
git remote get-url origin >/dev/null 2>&1 || git remote add origin https://github.com/APservice-application/SuvivalAcraft-open-world.git
git config --global user.name "APservice-application"
git config --global user.email "APservice-application@users.noreply.github.com"
git push -q origin main && echo "PUSH OK: $(git log --oneline -1)"
