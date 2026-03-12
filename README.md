# API Documentation

> **Base URL:** `/api`
> **Autenticação:** via cookies `httpOnly` (`accessToken` e `refreshToken`)
> **Formato:** JSON

---

## Sumário

- [Auth](#auth)
  - [POST /auth/register](#post-authregister)
  - [POST /auth/login](#post-authlogin)
  - [POST /auth/verify](#post-authverify)
  - [GET /auth/me](#get-authme)
  - [POST /auth/refresh](#post-authrefresh)
  - [POST /auth/logout](#post-authlogout)
- [OAuth](#oauth)
  - [GET /auth/oauth/google](#get-authoauthgoogle)
  - [GET /auth/oauth/google/callback](#get-authoauthgooglecallback)
  - [GET /auth/oauth/github](#get-authoauthgithub)
  - [GET /auth/oauth/github/callback](#get-authoauthgithubcallback)
- [Products](#products)
  - [POST /products](#post-products)
  - [GET /products](#get-products)
  - [GET /products/:id](#get-productsid)
  - [PUT /products/:id](#put-productsid)
  - [DELETE /products/:id](#delete-productsid)

---

## Auth

### POST /auth/register

Inicia o cadastro de um novo usuário. Não cria a conta ainda — envia um código de verificação por e-mail para confirmar o cadastro.

**Requer autenticação:** Não
**Rate limit:** Sim

**Body:**

```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "password": "Senha123@"
}
```

| Campo | Tipo | Regras |
|-------|------|--------|
| `name` | string | mínimo 2 caracteres |
| `email` | string | e-mail válido |
| `password` | string | 8-16 chars, 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial |

**Respostas:**

| Status | Descrição |
|--------|-----------|
| `201` | Código de verificação enviado para o e-mail |
| `400` | Body inválido (validação falhou) |
| `403` | E-mail já cadastrado |

**Exemplo de resposta `201`:**
```json
{
  "success": true,
  "message": "Verification code sent to email"
}
```

---

### POST /auth/login

Inicia o login. Assim como o register, **não retorna token diretamente** — envia um código de 6 dígitos para o e-mail do usuário.

**Requer autenticação:** Não
**Rate limit:** Sim

**Body:**

```json
{
  "email": "joao@email.com",
  "password": "Senha123@"
}
```

| Campo | Tipo | Regras |
|-------|------|--------|
| `email` | string | e-mail válido |
| `password` | string | qualquer string |

**Respostas:**

| Status | Descrição |
|--------|-----------|
| `200` | Código enviado para o e-mail |
| `400` | Body inválido |
| `401` | Usuário não encontrado ou senha inválida |

**Exemplo de resposta `200`:**
```json
{
  "success": true,
  "message": "Verification code sent to email"
}
```

---

### POST /auth/verify

Confirma o código de verificação enviado por e-mail. Ao confirmar, a conta é criada (ou o login é completado) e os cookies de sessão são definidos.

**Requer autenticação:** Não
**Rate limit:** Sim

**Body:**

```json
{
  "email": "joao@email.com",
  "code": "483920"
}
```

| Campo | Tipo | Regras |
|-------|------|--------|
| `email` | string | e-mail válido |
| `code` | string | exatamente 6 caracteres |

**Respostas:**

| Status | Descrição |
|--------|-----------|
| `200` | Autenticado com sucesso — cookies `accessToken` e `refreshToken` definidos |
| `400` | Body inválido |
| `401` | Código inválido, expirado ou já utilizado |

**Cookies definidos na resposta:**

| Cookie | Duração | Descrição |
|--------|---------|-----------|
| `accessToken` | 15 minutos | Token de acesso |
| `refreshToken` | 7 dias | Token para renovar o acesso |

**Exemplo de resposta `200`:**
```json
{
  "success": true,
  "message": "Authenticated successfully"
}
```

> **Fluxo completo de autenticação:**
> 1. `POST /auth/register` ou `POST /auth/login` → recebe código por e-mail
> 2. `POST /auth/verify` com o código → recebe os cookies de sessão
> 3. Usar o `accessToken` nas requisições subsequentes

---

### GET /auth/me

Retorna os dados do usuário autenticado, incluindo sessões ativas, logs e contas OAuth vinculadas.

**Requer autenticação:** Sim (cookie `accessToken`)
**Rate limit:** Não

**Respostas:**

| Status | Descrição |
|--------|-----------|
| `200` | Dados do usuário |
| `401` | Token ausente ou inválido |

**Exemplo de resposta `200`:**
```json
{
  "id": "uuid",
  "name": "João Silva",
  "email": "joao@email.com",
  "role": "USER",
  "avatarUrl": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "sessions": [...],
  "activeLogs": [...],
  "oauthAccounts": [...]
}
```

---

### POST /auth/refresh

Gera um novo par de tokens (`accessToken` + `refreshToken`) a partir do `refreshToken` atual. O token antigo é invalidado (rotação de token).

**Requer autenticação:** Não (mas precisa do cookie `refreshToken`)
**Rate limit:** Sim

**Respostas:**

| Status | Descrição |
|--------|-----------|
| `200` | Novos cookies definidos |
| `401` | `refreshToken` ausente, inválido, expirado ou sessão não encontrada |

**Cookies renovados:**

| Cookie | Duração |
|--------|---------|
| `accessToken` | 15 minutos |
| `refreshToken` | 7 dias |

**Exemplo de resposta `200`:**
```json
{
  "success": true,
  "message": "Token refreshed"
}
```

> **Quando chamar:** Quando uma requisição retornar `401`, tente fazer refresh. Se o refresh também falhar, redirecione o usuário para o login.

---

### POST /auth/logout

Encerra a sessão do usuário, deletando a sessão no banco e limpando os cookies.

**Requer autenticação:** Sim (cookie `accessToken`)
**Rate limit:** Não

**Respostas:**

| Status | Descrição |
|--------|-----------|
| `200` | Logout realizado, cookies limpos |
| `401` | Token ausente ou inválido |

**Exemplo de resposta `200`:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## OAuth

> O fluxo OAuth é baseado em **redirecionamento de browser**. O front-end deve abrir as rotas de redirect diretamente (não via fetch/axios), pois há redirecionamentos HTTP envolvidos.

### GET /auth/oauth/google

Redireciona o usuário para a página de login do Google.

**Requer autenticação:** Não
**Como usar no front:** `window.location.href = '/api/auth/oauth/google'`

**Resposta:** Redirecionamento `302` para o Google.

---

### GET /auth/oauth/google/callback

Rota interna. O Google redireciona o usuário aqui após o login. Cria ou encontra o usuário, gera a sessão e define os cookies.

**Não chamar diretamente.** Esta rota é chamada pelo Google automaticamente.

**Respostas:**

| Status | Descrição |
|--------|-----------|
| `200` | Autenticado — cookies `accessToken` e `refreshToken` definidos |
| `400` | Erro no OAuth (state inválido, code ausente, sem e-mail) |
| `500` | Erro interno ao comunicar com o Google |

---

### GET /auth/oauth/github

Redireciona o usuário para a página de autorização do GitHub.

**Requer autenticação:** Não
**Como usar no front:** `window.location.href = '/api/auth/oauth/github'`

**Resposta:** Redirecionamento `302` para o GitHub.

---

### GET /auth/oauth/github/callback

Rota interna. O GitHub redireciona o usuário aqui após autorizar. Cria ou encontra o usuário, gera a sessão e define os cookies.

**Não chamar diretamente.** Esta rota é chamada pelo GitHub automaticamente.

**Respostas:**

| Status | Descrição |
|--------|-----------|
| `200` | Autenticado — cookies `accessToken` e `refreshToken` definidos |
| `400` | Erro no OAuth (state inválido, code ausente, sem e-mail, usuário cancelou) |
| `500` | Erro interno ao comunicar com o GitHub |

---

## Products

> Todas as rotas de products requerem autenticação via cookie `accessToken`.
> Rotas de criação, edição e deleção são restritas a usuários com `role: ADMIN`.

---

### POST /products

Cria um novo produto. Apenas admins.

**Requer autenticação:** Sim
**Requer admin:** Sim

**Body:**

```json
{
  "name": "Mouse Gamer XYZ",
  "description": "Mouse com 16000 DPI",
  "price": 299.99,
  "imageUrl": "https://exemplo.com/mouse.jpg",
  "stockQuantity": 50
}
```

| Campo | Tipo | Regras |
|-------|------|--------|
| `name` | string | obrigatório |
| `description` | string | obrigatório |
| `price` | number | positivo |
| `imageUrl` | string | URL válida |
| `stockQuantity` | number | inteiro, não-negativo |

**Respostas:**

| Status | Descrição |
|--------|-----------|
| `201` | Produto criado com sucesso |
| `400` | Body inválido |
| `401` | Não autenticado |
| `403` | Usuário não é admin |

**Exemplo de resposta `201`:**
```json
{
  "message": "Product created successfully",
  "product": {
    "id": "uuid",
    "name": "Mouse Gamer XYZ",
    "description": "Mouse com 16000 DPI",
    "price": 299.99,
    "imageUrl": "https://exemplo.com/mouse.jpg",
    "stockQuantity": 50,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### GET /products

Retorna a lista de todos os produtos.

**Requer autenticação:** Sim
**Requer admin:** Não

**Respostas:**

| Status | Descrição |
|--------|-----------|
| `200` | Lista de produtos |
| `401` | Não autenticado |

**Exemplo de resposta `200`:**
```json
{
  "message": "product retrieved successfully",
  "products": [
    {
      "id": "uuid",
      "name": "Mouse Gamer XYZ",
      "description": "Mouse com 16000 DPI",
      "price": 299.99,
      "imageUrl": "https://exemplo.com/mouse.jpg",
      "stockQuantity": 50
    }
  ]
}
```

---

### GET /products/:id

Retorna os dados de um produto específico pelo ID.

**Requer autenticação:** Sim
**Requer admin:** Não

**Parâmetro de rota:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string (UUID) | ID do produto |

**Respostas:**

| Status | Descrição |
|--------|-----------|
| `200` | Dados do produto |
| `401` | Não autenticado |
| `404` | Produto não encontrado |

**Exemplo de resposta `200`:**
```json
{
  "message": "product retrieved successfully",
  "product": {
    "id": "uuid",
    "name": "Mouse Gamer XYZ",
    "description": "Mouse com 16000 DPI",
    "price": 299.99,
    "imageUrl": "https://exemplo.com/mouse.jpg",
    "stockQuantity": 50
  }
}
```

---

### PUT /products/:id

Atualiza os dados de um produto. Apenas admins. Todos os campos são opcionais.

**Requer autenticação:** Sim
**Requer admin:** Sim

**Parâmetro de rota:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string (UUID) | ID do produto |

**Body (todos opcionais):**

```json
{
  "name": "Mouse Gamer XYZ Pro",
  "description": "Versão atualizada",
  "price": 349.99,
  "imageUrl": "https://exemplo.com/mouse-pro.jpg"
}
```

| Campo | Tipo | Regras |
|-------|------|--------|
| `name` | string | opcional |
| `description` | string | opcional |
| `price` | number | positivo, opcional |
| `imageUrl` | string | URL válida, opcional |

**Respostas:**

| Status | Descrição |
|--------|-----------|
| `200` | Produto atualizado |
| `401` | Não autenticado |
| `403` | Usuário não é admin |
| `404` | Produto não encontrado |

**Exemplo de resposta `200`:**
```json
{
  "message": "Product updated successfully",
  "product": {
    "id": "uuid",
    "name": "Mouse Gamer XYZ Pro",
    "price": 349.99
  }
}
```

---

### DELETE /products/:id

Remove um produto. Apenas admins.

**Requer autenticação:** Sim
**Requer admin:** Sim

**Parâmetro de rota:**

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | string (UUID) | ID do produto |

**Respostas:**

| Status | Descrição |
|--------|-----------|
| `200` | Produto deletado com sucesso |
| `401` | Não autenticado |
| `403` | Usuário não é admin |
| `404` | Produto não encontrado |

**Exemplo de resposta `200`:**
```json
{
  "message": "Product deleted successfully"
}
```

---

## Códigos de Erro Comuns

| Status | Significado |
|--------|-------------|
| `400` | Requisição inválida (body malformado, campos ausentes ou fora das regras) |
| `401` | Não autenticado (token ausente, expirado ou inválido) |
| `403` | Proibido (autenticado, mas sem permissão — ex: não é admin, e-mail já cadastrado) |
| `404` | Recurso não encontrado |
| `500` | Erro interno do servidor |

---

## Fluxo de Autenticação Recomendado (Frontend)

```
1. Usuário preenche email + senha
2. POST /auth/login ou /auth/register
3. Usuário recebe código por e-mail
4. POST /auth/verify com o código
5. Cookies httpOnly definidos automaticamente pelo browser
6. Requisições autenticadas funcionam automaticamente (o browser envia os cookies)
7. Se retornar 401 → POST /auth/refresh
8. Se refresh falhar → redirecionar para login
9. Logout → POST /auth/logout
```

> **Nota:** Como os cookies são `httpOnly`, **não é possível lê-los via JavaScript**. O browser os envia automaticamente. Certifique-se de usar `credentials: 'include'` no fetch ou `withCredentials: true` no axios.
