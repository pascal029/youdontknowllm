import type { Meta, StoryObj } from '@storybook/react-vite'
import Modal from './Modal'
import ToolEditor, { NEW_TOOL_TEMPLATE } from './ToolEditor'

const meta = {
  component: ToolEditor,
  args: { initial: NEW_TOOL_TEMPLATE, takenNames: ['calculator'], onSave: () => {}, onCancel: () => {} },
  decorators: [(S) => <div style={{ maxWidth: 640 }}><S /></div>],
} satisfies Meta<typeof ToolEditor>
export default meta
type Story = StoryObj<typeof meta>

/** Uses the real sandbox worker — try "Test run". */
export const NewTool: Story = {}
export const DuplicateName: Story = { args: { takenNames: ['reverse_text'] } }
/** How the playground shows it. */
export const InModal: Story = {
  render: (args) => (
    <Modal open size="lg" title="Add tool" onClose={() => {}}>
      <ToolEditor {...args} />
    </Modal>
  ),
}
