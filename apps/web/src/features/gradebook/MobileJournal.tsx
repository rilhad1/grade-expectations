import type { GradebookDto } from '@ge/shared';
import ChevronRight from '@mui/icons-material/ChevronRight';
import {
  Box,
  Button,
  ButtonBase,
  List,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';

import { todayKyiv } from '../../app/today';
import { formatWeekdayDate } from '../../shared/format';
import { uk } from '../../shared/i18n/uk';
import { EmptyState } from '../../shared/ui/EmptyState';
import { SegmentedControl } from '../../shared/ui/SegmentedControl';
import { LinkListItem } from '../../shared/ui/links';
import { gradeTone } from '../lesson/model';

type Student = GradebookDto['students'][number];
type Tab = 'students' | 'lessons' | 'columns';
const m = uk.gradebook.mobile;

/**
 * Журнал на телефоні: замість широкої сітки — три розділи. «Студенти» (підсумки й картка),
 * «Заняття» (перехід на екран «На парі» для відміток і оцінок, у тому числі за минулі дати),
 * «Колонки» (практичні й модулі: введення оцінок списком).
 */
export function MobileJournal({
  data,
  onOpenStudent,
  onAddColumn,
  onOpenColumn,
}: {
  data: GradebookDto;
  onOpenStudent: (student: Student) => void;
  onAddColumn: () => void;
  onOpenColumn: (assessmentId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('students');
  const scale = data.load.gradingRules.scale;

  return (
    <Stack spacing={1.5}>
      <SegmentedControl
        ariaLabel={m.tabs}
        fullWidth
        value={tab}
        onChange={setTab}
        options={[
          { value: 'students' as const, label: m.students },
          { value: 'lessons' as const, label: m.lessons },
          { value: 'columns' as const, label: m.columns },
        ]}
      />

      {tab === 'students' && (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <List disablePadding>
            {data.students.map((s, index) => {
              const avg = s.summary.average;
              const tone = avg === null ? 'none' : gradeTone(scale, Math.round(avg));
              return (
                <ButtonBase
                  key={s.enrollmentId}
                  onClick={() => {
                    onOpenStudent(s);
                  }}
                  sx={{
                    width: '100%',
                    minHeight: 60,
                    px: 2,
                    gap: 1.25,
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography
                    className="tnum"
                    sx={{ width: 20, fontSize: 13, color: 'ge.text3', textAlign: 'right' }}
                  >
                    {index + 1}
                  </Typography>
                  <Typography
                    noWrap
                    sx={{ flex: 1, color: s.summary.risk.length > 0 ? 'ge.errFg' : 'text.primary' }}
                  >
                    {s.lastName} {s.firstName}
                  </Typography>
                  {s.summary.absences.unexcused > 0 && (
                    <Typography
                      className="tnum"
                      sx={{
                        fontSize: 14,
                        color: s.summary.absencePercent > 30 ? 'ge.errFg' : 'text.secondary',
                      }}
                    >
                      {s.summary.absences.unexcused} {uk.gradebook.absShort}
                    </Typography>
                  )}
                  <Box
                    component="span"
                    className="tnum"
                    sx={{
                      minWidth: 40,
                      height: 30,
                      px: 0.75,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '6px',
                      fontSize: 15,
                      fontWeight: 600,
                      bgcolor:
                        tone === 'low'
                          ? 'ge.grade.low'
                          : tone === 'high'
                            ? 'ge.grade.high'
                            : 'ge.sunken',
                    }}
                  >
                    {avg === null ? uk.common.none : avg.toFixed(1).replace('.', ',')}
                  </Box>
                </ButtonBase>
              );
            })}
          </List>
        </Paper>
      )}

      {tab === 'lessons' && <LessonList lessons={data.lessons} />}

      {tab === 'columns' && (
        <>
          {data.assessments.length === 0 ? (
            <EmptyState title={m.noColumns} description={m.noColumnsHint} />
          ) : (
            <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
              <List disablePadding>
                {data.assessments.map((a) => {
                  const filled = data.students.filter((s) => s.assessmentGrades[a.id]).length;
                  return (
                    <ButtonBase
                      key={a.id}
                      onClick={() => {
                        onOpenColumn(a.id);
                      }}
                      sx={{
                        width: '100%',
                        minHeight: 64,
                        px: 2,
                        gap: 1,
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          {a.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {a.attestationKind
                            ? uk.attestations.modules[a.attestationKind]
                            : uk.gradebook.assessment.noAttestation}
                          {' · '}
                          {m.filled(filled, data.students.length)}
                        </Typography>
                      </Box>
                      <ChevronRight sx={{ color: 'ge.text3' }} />
                    </ButtonBase>
                  );
                })}
              </List>
            </Paper>
          )}
          <Button variant="outlined" onClick={onAddColumn}>
            + {uk.gradebook.assessment.add}
          </Button>
        </>
      )}
    </Stack>
  );
}

/** Заняття журналу списком: перехід на «На парі», сьогоднішнє виділене й видиме одразу. */
function LessonList({ lessons }: { lessons: GradebookDto['lessons'] }) {
  const today = todayKyiv();
  const anchor = useRef<HTMLAnchorElement | null>(null);
  // Найближче до сьогодні (перше не раніше за сьогодні, інакше останнє)
  const nearest =
    lessons.find((l) => l.date >= today)?.id ?? lessons[lessons.length - 1]?.id ?? null;
  useEffect(() => {
    // jsdom не реалізує scrollIntoView
    if (typeof anchor.current?.scrollIntoView === 'function')
      anchor.current.scrollIntoView({ block: 'center' });
  }, []);

  if (lessons.length === 0) return <EmptyState title={uk.gradebook.noLessons} />;
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <List disablePadding>
        {lessons.map((l) => {
          const isToday = l.date === today;
          return (
            <LinkListItem
              key={l.id}
              to="/lessons/$lessonId"
              params={{ lessonId: l.id }}
              ref={l.id === nearest ? anchor : undefined}
              sx={{
                minHeight: 60,
                gap: 1.25,
                borderBottom: 1,
                borderColor: 'divider',
                ...(isToday && { bgcolor: 'ge.accentSoft' }),
              }}
            >
              <Box
                component="span"
                sx={{
                  minWidth: 34,
                  height: 24,
                  px: 0.5,
                  borderRadius: '4px',
                  bgcolor: 'ge.sunken',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'text.secondary',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {uk.loads.kindsShort[l.kind]}
              </Box>
              <ListItemText
                primary={
                  <>
                    {formatWeekdayDate(l.date)} · {l.pairNumber} {uk.today.pair}
                    {isToday && ` · ${m.today}`}
                  </>
                }
                secondary={l.topic ?? undefined}
                slotProps={{ secondary: { noWrap: true } }}
              />
              <Typography
                variant="caption"
                sx={{ color: l.status === 'PLANNED' ? 'ge.text3' : 'ge.ok', fontWeight: 600 }}
              >
                {l.status === 'PLANNED' ? m.planned : m.held}
              </Typography>
            </LinkListItem>
          );
        })}
      </List>
    </Paper>
  );
}
