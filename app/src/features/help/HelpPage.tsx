import { Card, Collapse, Typography } from 'antd'
import { ru } from '@/shared/i18n/ru'
import { PageHeader } from '@/shared/ui/PageHeader'
import { isClient } from '@/features/auth/permissions'
import { useMe } from '@/features/auth/useMe'

const t = ru.help

export default function HelpPage() {
  const { data: me } = useMe()
  const sections = me && isClient(me) ? t.client : t.staff
  return (
    <>
      <PageHeader title={t.title} subtitle={t.subtitle} />
      <Card>
        <Collapse
          defaultActiveKey={[0]}
          items={sections.map((s, i) => ({
            key: i,
            label: s.title,
            children: (
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {s.steps.map((step) => (
                  <li key={step} style={{ marginBottom: 6 }}>
                    <Typography.Text>{step}</Typography.Text>
                  </li>
                ))}
              </ol>
            ),
          }))}
        />
      </Card>
    </>
  )
}
