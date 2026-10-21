import { Link } from 'react-router-dom'
import { Table, Tag, Typography } from 'antd'
import { ru } from '@/shared/i18n/ru'
import type { EmployeeDetail } from './employeesApi'

const t = ru.employees.subs
const STATUS_COLOR = { active: 'green', invited: 'gold', blocked: 'red' } as const

/** Руководитель и подчинённые по цепочке. */
export function SubordinatesTab({ detail }: { detail: EmployeeDetail }) {
  return (
    <div>
      <p>
        <strong>{t.manager}: </strong>
        {detail.manager ? (
          <Link to={`/admin/employees/${detail.manager.id}`}>{detail.manager.name}</Link>
        ) : (
          <span className="muted">—</span>
        )}
      </p>
      <Typography.Paragraph type="secondary">{t.hint}</Typography.Paragraph>
      <Table
        rowKey="id"
        size="middle"
        pagination={false}
        dataSource={detail.subordinates}
        locale={{ emptyText: t.none }}
        columns={[
          {
            title: t.colName,
            render: (_, s) => <Link to={`/admin/employees/${s.id}`}>{`${'— '.repeat(s.depth - 1)}${s.name}`}</Link>,
          },
          { title: ru.employees.columns.role, dataIndex: 'roleName' },
          { title: ru.employees.columns.manager, render: (_, s) => t.depth(s.depth) },
          {
            title: ru.employees.columns.status,
            render: (_, s) => <Tag color={STATUS_COLOR[s.status]}>{ru.employees.statusTag[s.status]}</Tag>,
          },
        ]}
      />
    </div>
  )
}
