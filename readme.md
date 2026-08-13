# inMessages

Mensageria em tempo real, criptografada, inspirada no visual do iMessage do iOS 6. PWA instalável, funciona offline e manda notificação push.

## Stack

- **Frontend:** HTML/CSS/JS puro (ES Modules), sem framework
- **Backend:** Firebase (Auth, Firestore, Cloud Functions v2, Cloud Messaging)
- **PWA:** Service Worker com cache offline + push notifications

## Funcionalidades

- Cadastro e login por e-mail/senha
- Conversas 1-a-1 por `@username`
- Mensagens em tempo real, com reply e indicador de "digitando…"
- Bloquear/desbloquear usuário
- Notificação push (mesmo com o app fechado)
- Funciona offline (cache de mensagens via Service Worker)
- Instalável como app (PWA)

## Estrutura

```
.
├── direct.html            # tela principal (lista + chat)
├── login.html
├── register.html
├── manifest.json
├── pwa.js                 # registra o service worker
├── sw.js                  # cache offline + push em background
├── src/
│   ├── components/
│   │   └── direct-chat.js # lógica da UI de chat
│   └── services/
│       ├── auth.js        # login, cadastro, block/unblock
│       ├── messages.js     # conversas e mensagens (Firestore)
│       └── push.js        # registro do token FCM
├── public/
│   └── firebase-config.js # config do projeto Firebase (não versionar chaves sensíveis)
├── functions/
│   └── index.js           # Cloud Function que dispara o push
└── firestore.rules
```

## Rodando local

Como é HTML/JS puro, basta servir os arquivos estáticos:

```bash
npx serve .
# ou
python3 -m http.server 8080
```

Abra `login.html` (ou `direct.html`, que redireciona se não estiver logado).

## Configurar o Firebase

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com)
2. Ative **Authentication** (método Email/Senha), **Firestore** e **Cloud Messaging**
3. Preencha `public/firebase-config.js` com as credenciais do seu projeto (exportando `app`, `auth` e `db`)
4. Gere a chave VAPID em **Configurações do projeto → Cloud Messaging → Web configuration** e cole em `src/services/push.js`
5. Cole o mesmo `firebaseConfig` dentro de `sw.js` (o service worker não consegue importar o módulo, precisa dos valores direto no arquivo)

## Deploy das regras e da Cloud Function

Requer plano **Blaze** (pay-as-you-go) no Firebase.

```bash
npm install -g firebase-tools
firebase login
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules
```

## Segurança

- Regras do Firestore em `firestore.rules` — cada usuário só lê/escreve o que pode
- Senhas e sessão gerenciadas pelo Firebase Auth
- Bloqueio de usuário impede leitura/escrita de novas mensagens entre as partes

## Autor

**maxgfortes**
GitHub: [github.com/maxgfortes](https://github.com/maxgfortes)