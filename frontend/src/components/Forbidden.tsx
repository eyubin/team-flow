import { LockClosedIcon } from '@radix-ui/react-icons'
import { Box, Callout, Flex, Heading, Link, Text } from '@radix-ui/themes'

type ForbiddenProps = {
  message?: string
}

export function Forbidden({ message }: ForbiddenProps) {
  return (
    <Box asChild maxWidth="30rem">
      <main>
        <Flex direction="column" gap="4">
          <Text size="1" color="red" weight="bold" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Access denied
          </Text>
          <Heading as="h1" size="7">
            You don't have permission to view this
          </Heading>
          <Callout.Root color="red" role="alert">
            <Callout.Icon>
              <LockClosedIcon />
            </Callout.Icon>
            <Callout.Text>
              {message ?? "Your role in this workspace doesn't allow this. Ask an admin for access if you think this is a mistake."}
            </Callout.Text>
          </Callout.Root>
          <Text as="p">
            <Link href="/dashboard">Back to dashboard</Link>
          </Text>
        </Flex>
      </main>
    </Box>
  )
}
