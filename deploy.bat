@echo off

ssh root@212.85.19.3 "cd .. && cd home && cd tecnomaub-quizz-info23 && cd htdocs && cd quizz-info23.tecnomaub.site && git pull && npm install --force && npm run build && pm2 start ecosystem.config.cjs"