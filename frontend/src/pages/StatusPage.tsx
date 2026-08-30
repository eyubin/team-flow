import { Box, Flex, Heading, Link, Text } from '@radix-ui/themes'
import { HealthStatus } from '../components/HealthStatus.tsx'

export function StatusPage() {
  return (
    <Box asChild maxWidth="34rem">
      <main>
        <Flex direction="column" gap="4">
          <Heading as="h1" size="8">
            TeamFlow
          </Heading>
          <Text as="p" color="gray" size="3">
            Local skeleton is up when the API health check below reports <Text weight="bold">UP</Text>.
          </Text>
          <HealthStatus />
          <Text as="p">
            <Link href="/auth">Open account flow</Link>
          </Text>
        </Flex>
      </main>
    </Box>
  )
}
