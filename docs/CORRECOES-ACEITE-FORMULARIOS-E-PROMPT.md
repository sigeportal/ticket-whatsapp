# Correções de aceite, formulários e prompt da fila

Validação em 27/10/2026. Branch: `codex/fix-aceite-formularios-e-prompt`.

## Comportamento corrigido

- O administrador pode assumir para si um atendimento existente sem fila ou em fila da própria empresa, sem exigir associação pessoal à fila. Transferências continuam validando os vínculos do destinatário, e outro administrador não pode tomar um atendimento já assumido.
- Senhas dos cadastros são validadas antes do envio conforme a política do backend: mínimo de 8 caracteres, maiúscula, minúscula, número e limite de 72 bytes UTF-8. A criação exige senha; editar sem preencher a senha preserva a atual.
- Formulários de usuários, filas, avisos, listas de contatos, respostas rápidas, etiquetas, agendamentos e listas de arquivos aguardam a conclusão do envio. Os seis cadastros que ainda fechavam após erro agora preservam o modal e os campos. Uploads de listas de arquivos também são aguardados e propagam falhas ao formulário.
- O seletor de prompt da fila oferece **Sem prompt** e envia `promptId: null`; a remoção foi verificada no banco isolado.

## Verificação

| Validação | Resultado |
| --- | --- |
| Backend `npm run build` | Aprovado |
| Frontend `npm run typecheck` e `npm run build` | Aprovados |
| `test:security` | 34/34 |
| `test:governance` | 12/12 |
| `test:reliability` | 14/14 |
| `test:ai-supervision` | 14/14 |
| `test:operation` | 15/15 |
| `test:homologation` | 16/16 |
| Frontend `npm run test:forms` | 47 verificações |
| Navegador: criação de usuário nos dois formulários, senha fraca, rejeição da API, nova tentativa e remoção do prompt | 7 verificações; zero exceções JavaScript |

Os testes do backend usam PostgreSQL/WASM isolado. O novo cenário de homologação passa pela autorização e pelo serviço real de atendimento e confirma conflito 409 para o segundo administrador. As verificações de navegador usam componentes reais com API simulada. Nenhum atendimento ou cadastro real foi alterado durante os testes.

Esta branch inclui as correções anteriores de encerramento sem fila e edição administrativa, ainda pendentes de merge na `main` no momento da validação.
