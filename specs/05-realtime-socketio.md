# 05 — Realtime (Socket.IO)

`frontend/src/api/socket.ts` já tem o stub esperando uma implementação real (`connectChat()`, `onMessage`, `send`, `disconnect`) — essa spec define o que precisa existir do lado do servidor (`backend/`) pra esse stub virar `connectReal`.

## Handshake / autenticação

```ts
const socket = io(VITE_SOCKET_URL, { auth: { token: accessToken } });
```

No servidor, um middleware do Socket.IO valida o JWT (mesmo access token do REST) antes de aceitar a conexão. Conexão sem token válido é rejeitada (`connect_error`).

## Rooms

Ao conectar, o servidor coloca o socket em duas rooms automaticamente, derivadas do JWT — **nunca** informadas pelo client:

- `tenant:<tenant_id>` — broadcasts que valem pra empresa inteira (ex.: alteração de escala visível a todos os coordenadores).
- `user:<user_id>` — eventos dirigidos a um usuário específico (mensagem nova, notificação nova).

Isso garante isolamento entre tenants no nível do realtime também, não só no REST.

## Eventos — MVP (fase inicial)

| Evento | Direção | Payload | Quando |
|---|---|---|---|
| `message:send` | client → server | `Message` (sem `id`/`created_at`) | usuário envia mensagem no chat |
| `message:new` | server → `user:<receiver_id>` | `Message` | logo após persistir a mensagem enviada via `message:send` (ou via `POST /messages`, que dispara o mesmo evento — REST e socket convergem no mesmo service layer) |
| `notification:new` | server → `user:<user_id>` | `Notification` | qualquer gatilho de notificação (ver [06](./06-regras-de-negocio.md#gatilhos-de-notificação)) — fecha o gap do sino da Topbar, que hoje é só decorativo |

## Eventos — fase 2 (opcionais, avaliar depois do MVP)

| Evento | Direção | Payload | Quando |
|---|---|---|---|
| `task:status_changed` | server → `tenant:<tenant_id>` | `{ taskId, oldStatus, newStatus }` | sincroniza o Kanban em tempo real entre coordenadores logados simultaneamente — sem isso, dois coordenadores editando ao mesmo tempo só veem a mudança do outro ao recarregar |
| `schedule:updated` | server → `tenant:<tenant_id>` | `{ workDate, creatorId }` | mesmo racional, pra tela de Escala |

Não implementar esses dois na primeira fase — o ganho (colaboração em tempo real entre múltiplos coordenadores) é real mas secundário; a maioria das agências do tamanho descrito na proposta tem 1-2 coordenadores logados ao mesmo tempo, então o custo de "recarregar a página" é baixo comparado ao custo de implementar sincronização de estado em tempo real corretamente (race conditions no Kanban, por exemplo).

## Reconexão / fallback

Socket.IO já faz retry automático. Enquanto desconectado, o frontend deve continuar funcional via REST puro (polling manual ao reabrir a tela de Mensagens/Notificações) — não criar uma dependência rígida do socket pra funcionalidade básica.
