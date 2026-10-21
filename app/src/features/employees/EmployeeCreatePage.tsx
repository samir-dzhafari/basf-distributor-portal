import { useNavigate } from 'react-router-dom'
import { App, Button, Card, Skeleton } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { errorMessage } from '@/app/api'
import { ru } from '@/shared/i18n/ru'
import { PageHeader } from '@/shared/ui/PageHeader'
import { EmployeeForm } from './EmployeeForm'
import { useListEmployeesQuery, useSaveEmployeeMutation } from './employeesApi'
import { defaultEmployeeQuery } from './employeeQuery'

const t = ru.employees

export default function EmployeeCreatePage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { data } = useListEmployeesQuery({ ...defaultEmployeeQuery(), pageSize: 50 })
  const [save, { isLoading }] = useSaveEmployeeMutation()

  return (
    <>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        style={{ paddingLeft: 0, marginBottom: 8 }}
        onClick={() => navigate('/admin/employees')}
      >
        {t.card.back}
      </Button>
      <PageHeader title={t.form.createTitle} subtitle={t.form.createHint} />
      <Card style={{ maxWidth: 860 }}>
        {!data ? (
          <Skeleton active />
        ) : (
          <EmployeeForm
            initial={{
              firstName: '',
              lastName: '',
              email: '',
              phone: '',
              roleId: data.refs.roles.find((r) => r.active && !r.fullAccess)?.id ?? '',
              managerId: undefined,
            }}
            roles={data.refs.roles}
            managers={data.rows.filter((e) => e.status !== 'blocked').map((e) => ({ id: e.id, name: e.name }))}
            submitLabel={t.form.create}
            submitting={isLoading}
            onSubmit={async (v) => {
              const r = await save(v)
              if ('error' in r) return void message.error(errorMessage(r.error))
              message.success(t.form.created)
              navigate(`/admin/employees/${r.data.id}?tab=zone`)
            }}
          />
        )}
      </Card>
    </>
  )
}
