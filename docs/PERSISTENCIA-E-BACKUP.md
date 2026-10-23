# Guia de Persistência de Dados e Backups (Named Volumes)

Este documento descreve como os dados da stack **Ticket WhatsApp** são persistidos no Docker, garantindo que nada seja perdido mesmo em caso de falha, reinicialização ou destruição acidental dos containers no Google Cloud (Compute Engine / VM Linux) ou qualquer outro ambiente.

---

## 1. Mapeamento de Volumes da Stack

O Docker utiliza **Named Volumes** para isolar o ciclo de vida dos dados do ciclo de vida dos containers.

| Volume Docker | Destino no Container | Conteúdo | Importância |
| :--- | :--- | :--- | :--- |
| `postgres_data` | `/var/lib/postgresql/data` | Mensagens, tickets, contatos, usuários, filas e configurações. | **Crítica** |
| `backend_sessions` | `/app/sessions` | Credenciais criptográficas do WhatsApp Baileys (`creds.json`, Signal keys). | **Alta** (evita re-leitura de QR Code) |
| `backend_public` | `/app/public` | Imagens, áudios gravados/recebidos, documentos e logos. | **Alta** |
| `redis_data` | `/data` | Filas de processamento (Bull) com persistência AOF ativada. | **Média** |
| Bind mount host | `./agilizap/backend/certs:/app/certs:ro` | Certificado `.p12` para integração Pix (Efí / Gerencianet). | **Alta** |

---

## 2. Garantias de Segurança contra Falhas

### O que acontece se o container morrer ou parar?
1. **Container morre (crash, OOM, reboot da máquina VM do Google Cloud):**
   - Todos os dados nos volumes continuam 100% intactos. Ao subir novamente (`restart: unless-stopped`), o container se conecta aos mesmos volumes.
2. **Executar `docker compose down`:**
   - Para e remove os containers e a rede, mas **mantém todos os volumes intactos**.
3. **Atualização da imagem / `docker compose up -d --build`:**
   - O código do backend ou frontend é atualizado, mas os dados do banco, sessões e arquivos continuam intocados.

> [!CAUTION]
> **Nunca execute `docker compose down -v`** em ambiente de produção, pois a flag `-v` solicita ao Docker a exclusão deliberada dos Named Volumes.

---

## 3. Container de Backup Automático Nativo (`ticket-backup`)

Para simplificar a operação no Google Cloud, a stack já inclui um serviço de backup automatizado integrado no `docker-compose.yml`:

```yaml
  backup:
    image: alpine:3.20
    container_name: ticket-backup
    # Acorda diariamente às 03:00 e salva em ./backups
    # Reter por padrão 7 dias (configurável via BACKUP_RETENTION_DAYS)
```

### Como ele funciona:
1. Ao executar `docker compose up -d`, o container `ticket-backup` sobe junto com a aplicação.
2. Faz um **backup de integridade inicial** assim que o banco estiver saudável.
3. Inicia um agendador interno (Cron) que roda **diariamente às 03:00 da madrugada** (horário de baixo tráfego).
4. O container gera na pasta `./backups/YYYYMMDD_HHMMSS/`:
   - `postgres_agilizap.sql.gz`: Dump compactado do banco de dados PostgreSQL.
   - `backend_sessions.tar.gz`: Credenciais de sessão do WhatsApp.
   - `backend_public.tar.gz`: Mídias e anexos recebidos/enviados.
5. Limpa automaticamente backups mais antigos que `BACKUP_RETENTION_DAYS` (padrão: 7 dias).

---

## 4. Executando Backup Manual Sob Demanda

Se desejar gerar um backup manual a qualquer instante:

#### No Linux (VM Google Cloud):
```bash
chmod +x scripts/backup.sh scripts/restore.sh
./scripts/backup.sh
```

#### No Windows (PowerShell):
```powershell
.\scripts\backup.ps1
```

---

## 5. Rotina de Restauração (Disaster Recovery)

Para restaurar um backup existente (por exemplo, após migrar de VM ou recuperar de pane):

#### No Linux (VM Google Cloud):
```bash
./scripts/restore.sh backups/20261023_150000
```

#### No Windows (PowerShell):
```powershell
.\scripts\restore.ps1 -BackupFolder .\backups\20261023_150000
```

Após o término da restauração, reinicie os containers para recarregar o estado:
```bash
docker compose restart
```

---

## 6. Sincronização Externa com o Google Cloud Storage (GCS)

Para proteção máxima contra perda acidental da VM ou falha de disco no Google Cloud, envie os backups para um bucket do **Google Cloud Storage (GCS)**:

1. **Crie um bucket no Google Cloud:**
   ```bash
   gcloud storage buckets create gs://meu-ticket-backups --location=southamerica-east1
   ```

2. **Crie uma rotina de sincronização (Cron na VM do GCP):**
   ```bash
   crontab -e
   ```
   Adicione para sincronizar todo dia às 04:00 (1 hora após o backup Docker terminar):
   ```cron
   0 4 * * * gcloud storage rsync -r /caminho/ticket-whatsapp/backups gs://meu-ticket-backups/ --delete-unmatched-destination-objects
   ```
   *Dica: Na classe Nearline ou Coldline do GCS, o armazenamento de backups custa centavos de real por mês e protege contra qualquer desastre na VM.*
