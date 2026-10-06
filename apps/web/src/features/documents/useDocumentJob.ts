import { uuidv7, type CreateDocumentInput, type DocumentDto } from '@ge/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { createDocument, fetchDocument } from '../../api/attestations';

/** Створює документ у фоновій задачі й опитує стан, поки він не буде готовий. */
export function useDocumentJob() {
  const [id, setId] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (input: CreateDocumentInput) => createDocument({ ...input, id: uuidv7() }),
    onSuccess: (doc) => {
      setId(doc.id);
    },
  });
  const poll = useQuery({
    queryKey: ['document', id],
    queryFn: () => fetchDocument(id ?? ''),
    enabled: id !== null,
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? 1000 : false),
  });
  const document: DocumentDto | undefined = poll.data ?? create.data;
  return {
    start: create.mutate,
    document,
    error: create.error ?? poll.error,
    busy: create.isPending || document?.status === 'PENDING',
  };
}
