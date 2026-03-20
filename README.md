# GearBit API

> API REST de e-commerce para periféricos de PC. Construída com Fastify, Prisma, PostgreSQL e Redis.

**Base URL:** `/api`  
**Autenticação:** cookies `httpOnly` (`accessToken` e `refreshToken`)  
**Formato:** JSON

---

## Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Fastify
- **ORM:** Prisma
- **Banco de dados:** PostgreSQL
- **Cache:** Redis (Upstash)
- **Pagamentos:** Asaas (PIX)
- **Frete:** Melhor Envio
- **Testes:** Vitest (integração)

---

## Sumário

- [Auth](#auth)
- [OAuth](#oauth)
- [Products](#products)
- [Cart](#cart)
- [Freight](#freight)
- [Order](#order)
- [Códigos de erro](#códigos-de-erro-comuns)
- [Fluxo de autenticação](#fluxo-de-autenticação-recomendado-frontend)

---

## Auth

### POST /auth/register

Inicia o cadastro de um novo usuário. Não cria a conta ainda — envia um código de verificação por e-mail para confirmar o cadastro.

**Requer autenticação:** Não | **Rate limit:** Sim

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

| Status | Descrição |
|--------|-----------|
| `201` | Código de verificação enviado para o e-mail |
| `400` | Body inválido |
| `403` | E-mail já cadastrado |

---

### POST /auth/login

Inicia o login. Envia um código de 6 dígitos para o e-mail do usuário.

**Requer autenticação:** Não | **Rate limit:** Sim

**Body:**

```json
{
  "email": "joao@email.com",
  "password": "Senha123@"
}
```

| Status | Descrição |
|--------|-----------|
| `200` | Código enviado para o e-mail |
| `400` | Body inválido |
| `401` | Usuário não encontrado ou senha inválida |

---

### POST /auth/verify

Confirma o código de verificação enviado por e-mail. Ao confirmar, a conta é criada (ou o login é completado) e os cookies de sessão são definidos.

**Requer autenticação:** Não | **Rate limit:** Sim

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

| Status | Descrição |
|--------|-----------|
| `200` | Autenticado — cookies `accessToken` e `refreshToken` definidos |
| `400` | Body inválido |
| `401` | Código inválido, expirado ou já utilizado |

**Cookies definidos:**

| Cookie | Duração |
|--------|---------|
| `accessToken` | 15 minutos |
| `refreshToken` | 7 dias |

> **Fluxo:** `register` ou `login` → recebe código por e-mail → `verify` → cookies de sessão

---

### GET /auth/me

Retorna os dados do usuário autenticado, incluindo sessões ativas, logs e contas OAuth vinculadas.

**Requer autenticação:** Sim

| Status | Descrição |
|--------|-----------|
| `200` | Dados do usuário |
| `401` | Token ausente ou inválido |

---

### POST /auth/refresh

Gera um novo par de tokens a partir do `refreshToken` atual. O token antigo é invalidado (rotação de token).

**Requer autenticação:** Não (precisa do cookie `refreshToken`) | **Rate limit:** Sim

| Status | Descrição |
|--------|-----------|
| `200` | Novos cookies definidos |
| `401` | `refreshToken` ausente, inválido, expirado ou sessão não encontrada |

---

### POST /auth/logout

Encerra a sessão do usuário, deletando a sessão no banco e limpando os cookies.

**Requer autenticação:** Sim

| Status | Descrição |
|--------|-----------|
| `200` | Logout realizado, cookies limpos |
| `401` | Token ausente ou inválido |

---

## OAuth

> O fluxo OAuth é baseado em **redirecionamento de browser**. O front-end deve abrir as rotas diretamente (`window.location.href`), não via fetch/axios.

### GET /auth/oauth/google

Redireciona para a página de login do Google.

**Como usar:** `window.location.href = '/api/auth/oauth/google'`

---

### GET /auth/oauth/google/callback

Rota interna chamada pelo Google após o login. Cria ou encontra o usuário, gera sessão e define os cookies.

**Não chamar diretamente.**

| Status | Descrição |
|--------|-----------|
| `200` | Autenticado — cookies definidos |
| `400` | Erro no OAuth (state inválido, code ausente, sem e-mail) |
| `500` | Erro interno ao comunicar com o Google |

---

### GET /auth/oauth/github

Redireciona para a página de autorização do GitHub.

**Como usar:** `window.location.href = '/api/auth/oauth/github'`

---

### GET /auth/oauth/github/callback

Rota interna chamada pelo GitHub após autorizar.

**Não chamar diretamente.**

| Status | Descrição |
|--------|-----------|
| `200` | Autenticado — cookies definidos |
| `400` | Erro no OAuth (state inválido, code ausente, usuário cancelou) |
| `500` | Erro interno ao comunicar com o GitHub |

---

## Products

> Todas as rotas requerem autenticação. Criação, edição e deleção são restritas a `role: ADMIN`.

### POST /products

Cria um novo produto.

**Requer autenticação:** Sim | **Requer admin:** Sim

**Body:**

```json
{
  "name": "Mouse Gamer XYZ",
  "description": "Mouse com 16000 DPI",
  "price": 299.99,
  "imageUrl": "https://exemplo.com/mouse.jpg",
  "stockQuantity": 50,
  "weight": 0.3,
  "width": 12,
  "height": 5,
  "length": 7
}
```

| Campo | Tipo | Regras |
|-------|------|--------|
| `name` | string | obrigatório |
| `description` | string | obrigatório |
| `price` | number | positivo |
| `imageUrl` | string | URL válida, opcional |
| `stockQuantity` | number | inteiro, não-negativo |
| `weight` | number | em kg, obrigatório para cálculo de frete |
| `width` | number | em cm, obrigatório para cálculo de frete |
| `height` | number | em cm, obrigatório para cálculo de frete |
| `length` | number | em cm, obrigatório para cálculo de frete |

| Status | Descrição |
|--------|-----------|
| `201` | Produto criado |
| `400` | Body inválido |
| `401` | Não autenticado |
| `403` | Não é admin |

---

### GET /products

Retorna a lista de todos os produtos.

**Requer autenticação:** Sim | **Requer admin:** Não

| Status | Descrição |
|--------|-----------|
| `200` | Lista de produtos |
| `401` | Não autenticado |

---

### GET /products/:id

Retorna um produto pelo ID.

**Requer autenticação:** Sim | **Requer admin:** Não

| Status | Descrição |
|--------|-----------|
| `200` | Dados do produto |
| `401` | Não autenticado |
| `404` | Produto não encontrado |

---

### PUT /products/:id

Atualiza um produto. Todos os campos são opcionais.

**Requer autenticação:** Sim | **Requer admin:** Sim

| Status | Descrição |
|--------|-----------|
| `200` | Produto atualizado |
| `401` | Não autenticado |
| `403` | Não é admin |
| `404` | Produto não encontrado |

---

### DELETE /products/:id

Remove um produto.

**Requer autenticação:** Sim | **Requer admin:** Sim

| Status | Descrição |
|--------|-----------|
| `200` | Produto deletado |
| `401` | Não autenticado |
| `403` | Não é admin |
| `404` | Produto não encontrado |

---

## Cart

> Todas as rotas requerem autenticação via cookie `accessToken`.

### POST /cart

Adiciona um produto ao carrinho do usuário. Cria o carrinho automaticamente se ainda não existir. Valida estoque antes de adicionar.

**Requer autenticação:** Sim

**Body:**

```json
{
  "productId": "uuid"
}
```

| Status | Descrição |
|--------|-----------|
| `201` | Produto adicionado ao carrinho |
| `400` | Body inválido ou produto sem estoque |
| `401` | Não autenticado |
| `404` | Produto não encontrado |

---

### GET /cart

Retorna os itens do carrinho do usuário autenticado com subtotais.

**Requer autenticação:** Sim

| Status | Descrição |
|--------|-----------|
| `200` | Itens do carrinho |
| `401` | Não autenticado |

**Exemplo de resposta `200`:**
```json
{
  "success": true,
  "data": {
    "products": {
      "cartItems": [
        {
          "productId": "uuid",
          "quantity": 2,
          "unitPrice": 299.99
        }
      ]
    }
  }
}
```

---

### PUT /cart

Incrementa ou decrementa a quantidade de um item no carrinho.

**Requer autenticação:** Sim

**Body:**

```json
{
  "productId": "uuid",
  "type": "increment"
}
```

| Campo | Tipo | Valores |
|-------|------|---------|
| `productId` | string | UUID do produto |
| `type` | string | `increment` ou `decrement` |

| Status | Descrição |
|--------|-----------|
| `200` | Quantidade atualizada |
| `400` | Body inválido |
| `401` | Não autenticado |
| `404` | Item não está no carrinho |

---

### DELETE /cart

Remove um produto do carrinho.

**Requer autenticação:** Sim

**Body:**

```json
{
  "productId": "uuid"
}
```

| Status | Descrição |
|--------|-----------|
| `200` | Item removido |
| `400` | Body inválido |
| `401` | Não autenticado |
| `404` | Item não está no carrinho |

---

## Freight

### POST /shipping/calculate

Calcula as opções de frete disponíveis para o CEP do usuário com base nos itens do carrinho atual.

**Requer autenticação:** Sim

**Body:** nenhum — utiliza o CEP cadastrado no perfil do usuário e os itens do carrinho atual.

| Status | Descrição |
|--------|-----------|
| `200` | Opções de frete retornadas |
| `400` | Usuário sem CEP cadastrado ou carrinho vazio |
| `401` | Não autenticado |

**Exemplo de resposta `200`:**
```json
{
  "success": true,
  "data": {
    "options": [
      {
        "name": "PAC",
        "price": 18.50,
        "deliveryDays": 7
      },
      {
        "name": "SEDEX",
        "price": 34.90,
        "deliveryDays": 2
      }
    ]
  }
}
```

---

## Order

### POST /order

Cria um pedido a partir dos itens do carrinho atual. Decrementa o estoque, limpa o carrinho e gera um QR Code PIX via Asaas. O pedido expira em 20 minutos se não for pago.

**Requer autenticação:** Sim

**Body:**

```json
{
  "cpf": "12345678901"
}
```

| Campo | Tipo | Regras |
|-------|------|--------|
| `cpf` | string | 11 dígitos numéricos |

| Status | Descrição |
|--------|-----------|
| `201` | Pedido criado — retorna QR Code PIX |
| `400` | Usuário sem CEP ou produto sem estoque |
| `401` | Não autenticado |
| `404` | Carrinho vazio |
| `500` | Falha ao gerar pagamento no Asaas |

**Exemplo de resposta `201`:**
```json
{
  "success": true,
  "message": "Pedido criado com sucesso!",
  "data": {
    "qrCode": "00020126...",
    "qrCodeBase64": "base64encodedimage..."
  }
}
```

> Se o Asaas falhar após o pedido ser criado no banco, o pedido é marcado como `CANCELLED` automaticamente.

---

### POST /order/webhook

Recebe notificações do Asaas sobre atualizações de pagamento. Atualiza o status do pedido e restaura o estoque em caso de falha no pagamento.

**Requer autenticação:** Sim *(a ser migrado para validação por IP/assinatura Asaas em produção)*

**Body (enviado pelo Asaas):**

```json
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_abc123",
    "status": "RECEIVED",
    "externalReference": null
  }
}
```

| Evento | Comportamento |
|--------|---------------|
| `PAYMENT_RECEIVED` + status `RECEIVED` | Marca pedido como `PAID` |
| `PAYMENT_RECEIVED` + qualquer outro status | Marca pedido como `CANCELLED` e restaura estoque |
| Qualquer outro evento | Ignorado |

| Status | Descrição |
|--------|-----------|
| `200` | Processado com sucesso (inclusive se o pedido não for encontrado) |

---

## Códigos de Erro Comuns

| Status | Significado |
|--------|-------------|
| `400` | Requisição inválida (body malformado, campos ausentes ou fora das regras) |
| `401` | Não autenticado (token ausente, expirado ou inválido) |
| `403` | Proibido (autenticado, mas sem permissão) |
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
6. Requisições autenticadas funcionam automaticamente
7. Se retornar 401 → POST /auth/refresh
8. Se refresh falhar → redirecionar para login
9. Logout → POST /auth/logout
```

> **Importante:** Como os cookies são `httpOnly`, não é possível lê-los via JavaScript. Certifique-se de usar `credentials: 'include'` no fetch ou `withCredentials: true` no axios.

---

## Testes

```bash
# Rodar todos os testes de integração
npm run test

# Rodar testes de um módulo específico
npx vitest run src/modules/orders/test/order.test.ts
```

Cobertura atual: **57 testes de integração** — auth, products, cart e order.
