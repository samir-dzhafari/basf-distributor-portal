import { useState } from 'react'
import { App, Button, Popconfirm, Select, Upload } from 'antd'
import { DeleteOutlined, DownloadOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { formatDateTime } from '@/shared/lib/format'
import { DOCUMENT_TYPES } from '@/shared/types/domain'
import {
  MAX_DOCUMENT_BYTES,
  useAddOrderDocumentMutation,
  useGetOrderDocumentMutation,
  useRemoveOrderDocumentMutation,
  type OrderView,
} from '../ordersViewApi'
import { downloadDocument, formatSize, readAsDataUrl } from './downloadDocument'

const t = ru.orders.card

/** Документы заказа: сотрудник загружает вручную, клиент просматривает и скачивает. */
export function OrderDocuments({
  orderId,
  documents,
  canUpload,
}: {
  orderId: string
  documents: OrderView['documents']
  canUpload: boolean
}) {
  const { message } = App.useApp()
  const [type, setType] = useState<string>(DOCUMENT_TYPES[0])
  const [add, { isLoading: adding }] = useAddOrderDocumentMutation()
  const [remove] = useRemoveOrderDocumentMutation()
  const [getDoc] = useGetOrderDocumentMutation()

  const upload = async (file: File) => {
    if (file.size > MAX_DOCUMENT_BYTES) {
      message.error(t.docTooBig)
      return false
    }
    const dataUrl = await readAsDataUrl(file)
    const r = await add({ id: orderId, type, fileName: file.name, size: file.size, dataUrl })
    if ('error' in r) message.error(errorMessage(r.error))
    else message.success(t.docUploaded)
    return false
  }

  const download = async (docId: string) => {
    const r = await getDoc({ id: orderId, docId })
    if ('error' in r) return void message.error(errorMessage(r.error))
    downloadDocument(r.data)
  }

  return (
    <div>
      {documents.length === 0 && <span className="muted">{t.documentsNone}</span>}
      {documents.map((d) => (
        <div key={d.id} className="doc-row">
          <div style={{ minWidth: 0 }}>
            <FileTextOutlined aria-hidden /> <strong>{d.type}</strong>
            <small style={{ overflowWrap: 'anywhere' }}>
              {d.fileName} {d.size ? `· ${formatSize(d.size)}` : ''}
            </small>
            <small>
              {formatDateTime(d.uploadedAt)} · {d.uploaderName}
            </small>
          </div>
          <div className="card-actions" style={{ flexWrap: 'nowrap' }}>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => download(d.id)}
              aria-label={`${t.docDownload}: ${d.fileName}`}
            >
              {t.docDownload}
            </Button>
            {canUpload && (
              <Popconfirm
                title={t.docRemoveTitle}
                okText={t.docRemove}
                cancelText={ru.common.cancel}
                onConfirm={async () => {
                  const r = await remove({ id: orderId, docId: d.id })
                  if ('error' in r) message.error(errorMessage(r.error))
                  else message.success(t.docRemoved)
                }}
              >
                <Button danger type="text" icon={<DeleteOutlined />} aria-label={`${t.docRemove}: ${d.fileName}`} />
              </Popconfirm>
            )}
          </div>
        </div>
      ))}

      {canUpload && (
        <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Select
            aria-label={t.docType}
            value={type}
            onChange={setType}
            style={{ minWidth: 190 }}
            options={DOCUMENT_TYPES.map((x) => ({ value: x, label: x }))}
          />
          <Upload showUploadList={false} beforeUpload={upload} disabled={adding}>
            <Button icon={<UploadOutlined />} loading={adding}>
              {t.docUpload}
            </Button>
          </Upload>
        </div>
      )}
    </div>
  )
}
