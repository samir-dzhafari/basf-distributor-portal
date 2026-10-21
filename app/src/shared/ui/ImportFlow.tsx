import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Result, Steps, Table, Tabs, Tag, Typography, Upload } from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, InboxOutlined } from '@ant-design/icons'
import type { ImportCounts, ImportIssue, ImportLine, ImportPreview } from '@/mocks/importTypes'
import { ru } from '@/shared/i18n/ru'
import { ImportFileError, downloadErrorReport } from '@/shared/lib/xlsxImport'
import { PageHeader } from './PageHeader'

const t = ru.importFlow
const ACTION_COLOR = { new: 'green', update: 'blue', error: 'red' } as const

type Reply<T> = Promise<{ data: T } | { error: unknown }>

export interface ImportFlowProps<I, K extends string> {
  title: string
  subtitle: string
  backLabel: string
  backPath: string
  templateHint: ReactNode
  /** Подписи листов в предпросмотре и отчёте об ошибках. */
  sheets: Record<K, string>
  downloadTemplate: () => Promise<void>
  readFile: (file: File) => Promise<I>
  check: (input: I) => Reply<ImportPreview<K>>
  apply: (input: I) => Reply<ImportCounts & { invites?: number }>
  doneText: (r: ImportCounts & { invites?: number }) => ReactNode
  doneNote?: ReactNode
  errorMessage: (e: unknown) => string
}

/** Общий сценарий импорта: шаблон и файл → проверка с отчётом об ошибках → загрузка корректных строк. */
export function ImportFlow<I, K extends string>(p: ImportFlowProps<I, K>) {
  const navigate = useNavigate()
  const [input, setInput] = useState<I>()
  const [preview, setPreview] = useState<ImportPreview<K>>()
  const [done, setDone] = useState<ImportCounts & { invites?: number }>()
  const [fileError, setFileError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const step = done ? 2 : preview ? 1 : 0
  const keys = Object.keys(p.sheets) as K[]
  const reset = () => {
    setInput(undefined)
    setPreview(undefined)
    setDone(undefined)
    setFileError(undefined)
  }

  const onFile = async (file: File) => {
    setFileError(undefined)
    setBusy(true)
    try {
      const data = await p.readFile(file)
      const r = await p.check(data)
      if ('error' in r) setFileError(p.errorMessage(r.error))
      else {
        setInput(data)
        setPreview(r.data)
      }
    } catch (e) {
      setFileError(e instanceof ImportFileError ? e.message : t.fileError)
    } finally {
      setBusy(false)
    }
    return false
  }

  const onApply = async () => {
    if (!input) return
    setBusy(true)
    const r = await p.apply(input)
    setBusy(false)
    if ('error' in r) setFileError(p.errorMessage(r.error))
    else setDone(r.data)
  }

  const loadable = preview ? preview.counts.new + preview.counts.update : 0

  return (
    <>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        style={{ paddingLeft: 0, marginBottom: 8 }}
        onClick={() => navigate(p.backPath)}
      >
        {p.backLabel}
      </Button>
      <PageHeader title={p.title} subtitle={p.subtitle} />
      <Steps
        size="small"
        current={step}
        style={{ marginBottom: 24 }}
        items={[{ title: t.step1 }, { title: t.step2 }, { title: t.step3 }]}
      />

      {done ? (
        <Card>
          <Result
            status="success"
            title={t.doneTitle}
            subTitle={
              <>
                {p.doneText(done)} {done.error > 0 && t.doneErrors(done.error)}
                {p.doneNote && (
                  <>
                    <br />
                    <span className="muted">{p.doneNote}</span>
                  </>
                )}
              </>
            }
            extra={[
              <Button key="back" type="primary" size="large" onClick={() => navigate(p.backPath)}>
                {p.backLabel}
              </Button>,
              <Button key="again" size="large" onClick={reset}>
                {t.again}
              </Button>,
            ]}
          />
        </Card>
      ) : !preview ? (
        <Card style={{ maxWidth: 820 }}>
          <Typography.Paragraph>{p.templateHint}</Typography.Paragraph>
          <Button
            size="large"
            icon={<DownloadOutlined />}
            onClick={() => p.downloadTemplate()}
            style={{ marginBottom: 20 }}
          >
            {t.downloadTemplate}
          </Button>
          {fileError && <Alert type="error" showIcon message={fileError} style={{ marginBottom: 16 }} role="alert" />}
          <Upload.Dragger accept=".xlsx" multiple={false} showUploadList={false} beforeUpload={onFile} disabled={busy}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{t.choose}</p>
            <p className="ant-upload-hint">{t.dropHint}</p>
          </Upload.Dragger>
        </Card>
      ) : (
        <>
          {fileError && <Alert type="error" showIcon message={fileError} style={{ marginBottom: 16 }} role="alert" />}
          <Alert
            type={preview.counts.error ? 'warning' : 'success'}
            showIcon
            message={t.summary(preview.counts.new, preview.counts.update, preview.counts.error)}
            description={preview.counts.error ? t.errorsHint : undefined}
            style={{ marginBottom: 16 }}
          />

          {preview.issues.length > 0 && (
            <Card
              title={t.errorsTitle}
              style={{ marginBottom: 16 }}
              extra={
                <Button icon={<DownloadOutlined />} onClick={() => downloadErrorReport(preview.issues, p.sheets)}>
                  {t.downloadReport}
                </Button>
              }
            >
              <Table<ImportIssue<K>>
                size="small"
                rowKey={(i) => `${i.sheet}-${i.row}-${i.message}`}
                dataSource={preview.issues}
                pagination={preview.issues.length > 8 ? { pageSize: 8, showSizeChanger: false } : false}
                columns={[
                  { title: t.sheet, render: (_, i) => p.sheets[i.sheet], width: 160 },
                  { title: t.row, dataIndex: 'row', width: 90 },
                  { title: t.errorsTitle, dataIndex: 'message' },
                ]}
              />
            </Card>
          )}

          <Card title={t.step2} style={{ marginBottom: 16 }}>
            <Tabs
              items={keys.map((k) => ({
                key: k,
                label: `${p.sheets[k]} (${preview.lines[k].length})`,
                children: (
                  <Table<ImportLine>
                    size="small"
                    rowKey="row"
                    dataSource={preview.lines[k]}
                    scroll={{ x: 'max-content' }}
                    pagination={preview.lines[k].length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
                    locale={{ emptyText: t.nothing }}
                    columns={[
                      { title: t.row, dataIndex: 'row', width: 90 },
                      { title: t.object, dataIndex: 'title' },
                      { title: t.change, dataIndex: 'detail', render: (v?: string) => v ?? '—' },
                      {
                        title: t.action,
                        render: (_, l) => <Tag color={ACTION_COLOR[l.action]}>{t.actions[l.action]}</Tag>,
                        width: 140,
                      },
                    ]}
                  />
                ),
              }))}
            />
          </Card>

          <div className="card-actions">
            <Button type="primary" size="large" loading={busy} disabled={!loadable} onClick={onApply}>
              {preview.counts.error ? t.applyValid : t.applyAll}
            </Button>
            <Button size="large" onClick={reset}>
              {t.back}
            </Button>
          </div>
        </>
      )}
    </>
  )
}
