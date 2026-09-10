import { Link as RouterLink } from 'react-router-dom'
import { Box, Flex, Heading, Link, Text } from '@radix-ui/themes'
import { HealthStatus } from '../components/HealthStatus.tsx'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

export function StatusPage() {
  useDocumentTitle('Status')
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
            <Link asChild>
              <RouterLink to="/">Open account flow</RouterLink>
            </Link>
          </Text>
        </Flex>
      </main>
    </Box>
  )
}
