import { Link as RouterLink } from 'react-router-dom'
import { Box, Flex, Heading, Link, Text } from '@radix-ui/themes'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

export function NotFoundPage() {
  useDocumentTitle('Page not found')

  return (
    <Box asChild maxWidth="30rem">
      <main>
        <Flex direction="column" gap="4">
          <Text size="1" color="gray" weight="bold" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            404
          </Text>
          <Heading as="h1" size="7">
            Page not found
          </Heading>
          <Text as="p" color="gray">
            The page you're looking for doesn't exist or may have moved.
          </Text>
          <Text as="p">
            <Link asChild>
              <RouterLink to="/">Back to home</RouterLink>
            </Link>
          </Text>
        </Flex>
      </main>
    </Box>
  )
}
