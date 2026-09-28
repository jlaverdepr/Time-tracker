import * as React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Pressable, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListProjects, useCreateProject, useDeleteProject, useCompleteProject, useReopenProject,
  getListProjectsQueryKey,
  useListSubprojects, useCreateSubproject, useDeleteSubproject, useCompleteSubproject, useReopenSubproject,
  getListSubprojectsQueryKey,
} from '@workspace/api-client-react';
import type { Project, Subproject } from '@workspace/api-client-react';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import { BottomSheetModal } from '../components/BottomSheetModal';
import { PROJECT_COLORS } from '@workspace/shared';

function SubprojectRow({ sub, color, onToggle, onDelete }: {
  sub: Subproject
  color: ThemeColors
  onToggle: (sub: Subproject) => void
  onDelete: (id: number) => void
}) {
  const done = sub.status === 'completed';
  return (
    <View style={styles.subRow}>
      <TouchableOpacity style={styles.subRowMain} onPress={() => onToggle(sub)}>
        <Ionicons
          name={done ? 'checkmark-circle' : 'ellipse-outline'}
          size={18}
          color={done ? '#10b981' : color.mutedForeground}
        />
        <Text style={[styles.subName, { color: done ? color.mutedForeground : color.foreground }, done && styles.strike]}>
          {sub.name}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onDelete(sub.id)} hitSlop={8}>
        <Ionicons name="trash-outline" size={15} color={color.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

function ProjectCard({ project, subs, color, onDeleteProject, onToggleProject }: {
  project: Project
  subs: Subproject[]
  color: ThemeColors
  onDeleteProject: (id: number) => void
  onToggleProject: (project: Project) => void
}) {
  const [expanded, setExpanded] = React.useState(true);
  const [newSubName, setNewSubName] = React.useState('');
  const queryClient = useQueryClient();
  const createSub = useCreateSubproject();
  const deleteSub = useDeleteSubproject();
  const completeSub = useCompleteSubproject();
  const reopenSub = useReopenSubproject();

  const isDone = project.status === 'completed';
  const activeSubs = subs.filter(s => s.status === 'active');
  const completedSubs = subs.filter(s => s.status === 'completed');

  function invalidateSubs() {
    queryClient.invalidateQueries({ queryKey: getListSubprojectsQueryKey() });
  }

  function handleAddSub() {
    const trimmed = newSubName.trim();
    if (!trimmed) return;
    createSub.mutate({ data: { projectId: project.id, name: trimmed } }, {
      onSuccess: () => { invalidateSubs(); setNewSubName(''); },
    });
  }

  function handleToggleSub(sub: Subproject) {
    if (sub.status === 'completed') reopenSub.mutate({ id: sub.id }, { onSuccess: invalidateSubs });
    else completeSub.mutate({ id: sub.id }, { onSuccess: invalidateSubs });
  }

  function handleDeleteSub(id: number) {
    deleteSub.mutate({ id }, { onSuccess: invalidateSubs });
  }

  return (
    <View style={[styles.card, { backgroundColor: color.card, borderColor: color.border }]}>
      <TouchableOpacity style={styles.cardHeader} onPress={() => setExpanded(v => !v)}>
        <View style={[styles.dot, { backgroundColor: project.color }]} />
        <Text style={[styles.cardTitle, { color: isDone ? color.mutedForeground : color.foreground }, isDone && styles.strike]}>
          {project.name}
        </Text>
        <Text style={[styles.subCount, { color: color.mutedForeground }]}>{subs.length}</Text>
        <TouchableOpacity onPress={() => onToggleProject(project)} hitSlop={8}>
          <Ionicons name={isDone ? 'refresh-outline' : 'checkmark-circle-outline'} size={20} color={isDone ? color.mutedForeground : '#10b981'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDeleteProject(project.id)} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={color.mutedForeground} />
        </TouchableOpacity>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={color.mutedForeground} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.cardBody}>
          {activeSubs.map(sub => (
            <SubprojectRow key={sub.id} sub={sub} color={color} onToggle={handleToggleSub} onDelete={handleDeleteSub} />
          ))}
          {completedSubs.map(sub => (
            <SubprojectRow key={sub.id} sub={sub} color={color} onToggle={handleToggleSub} onDelete={handleDeleteSub} />
          ))}
          {subs.length === 0 && (
            <Text style={[styles.empty, { color: color.mutedForeground }]}>No subprojects yet.</Text>
          )}
          <View style={styles.addRow}>
            <TextInput
              style={[styles.addInput, { color: color.foreground }]}
              value={newSubName}
              onChangeText={setNewSubName}
              placeholder="Add a subproject…"
              placeholderTextColor={color.mutedForeground}
              onSubmitEditing={handleAddSub}
              returnKeyType="done"
            />
            {newSubName.trim().length > 0 && (
              <TouchableOpacity onPress={handleAddSub} hitSlop={8}>
                <Ionicons name="add-circle" size={20} color={color.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function AddProjectModal({ visible, onClose, color }: { visible: boolean; onClose: () => void; color: ThemeColors }) {
  const queryClient = useQueryClient();
  const createProject = useCreateProject();
  const [name, setName] = React.useState('');
  const [selectedColor, setSelectedColor] = React.useState(PROJECT_COLORS[0]);

  function reset() { setName(''); setSelectedColor(PROJECT_COLORS[0]); }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createProject.mutate({ data: { name: trimmed, color: selectedColor } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        reset();
        onClose();
      },
    });
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
        <View style={[styles.modalCard, { backgroundColor: color.card }]}>
          <Text style={[styles.modalTitle, { color: color.foreground }]}>New Project</Text>
          <TextInput
            style={[styles.modalInput, { borderColor: color.border, color: color.foreground }]}
            value={name}
            onChangeText={setName}
            placeholder="Project name"
            placeholderTextColor={color.mutedForeground}
          />
          <View style={styles.colorRow}>
            {PROJECT_COLORS.map(c => (
              <Pressable
                key={c}
                onPress={() => setSelectedColor(c)}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  selectedColor === c && { borderWidth: 3, borderColor: color.foreground },
                ]}
              />
            ))}
          </View>
          <View style={styles.modalButtons}>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} style={styles.modalButton}>
              <Text style={{ color: color.mutedForeground }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreate} style={[styles.modalButton, { backgroundColor: color.primary, borderRadius: 8 }]}>
              <Text style={{ color: color.primaryForeground, fontWeight: '600' }}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
    </BottomSheetModal>
  );
}

export default function ProjectsScreen() {
  const color = useThemeColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading } = useListProjects();
  const { data: allSubs = [] } = useListSubprojects();
  const deleteProject = useDeleteProject();
  const completeProject = useCompleteProject();
  const reopenProject = useReopenProject();
  const [addOpen, setAddOpen] = React.useState(false);

  const subsByProject = React.useMemo(() => {
    const map = new Map<number, Subproject[]>();
    for (const s of allSubs) {
      if (!map.has(s.projectId)) map.set(s.projectId, []);
      map.get(s.projectId)!.push(s);
    }
    return map;
  }, [allSubs]);

  function invalidateProjects() {
    queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
  }

  function handleDeleteProject(id: number) {
    Alert.alert('Delete project?', 'This will also delete its subprojects. This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteProject.mutate({ id }, { onSuccess: invalidateProjects }) },
    ]);
  }

  function handleToggleProject(project: Project) {
    if (project.status === 'completed') reopenProject.mutate({ id: project.id }, { onSuccess: invalidateProjects });
    else completeProject.mutate({ id: project.id }, { onSuccess: invalidateProjects });
  }

  const activeProjects = projects.filter(p => p.status === 'active');
  const completedProjects = projects.filter(p => p.status === 'completed');

  return (
    <View style={[styles.container, { backgroundColor: color.background, paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: color.foreground }]}>Projects</Text>
        <TouchableOpacity onPress={() => setAddOpen(true)}>
          <Ionicons name="add-circle-outline" size={28} color={color.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={color.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {projects.length === 0 && (
            <Text style={[styles.empty, { color: color.mutedForeground }]}>No projects yet. Tap + to create one.</Text>
          )}
          {[...activeProjects, ...completedProjects].map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              subs={subsByProject.get(project.id) ?? []}
              color={color}
              onDeleteProject={handleDeleteProject}
              onToggleProject={handleToggleProject}
            />
          ))}
        </ScrollView>
      )}

      <AddProjectModal visible={addOpen} onClose={() => setAddOpen(false)} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  content: { gap: 12, paddingBottom: 20 },
  empty: { textAlign: 'center', marginTop: 24, fontSize: 14 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  cardTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  subCount: { fontSize: 12 },
  strike: { textDecorationLine: 'line-through' },
  cardBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 2 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  subRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  subName: { fontSize: 14 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  addInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 },
  modalButton: { paddingHorizontal: 16, paddingVertical: 10 },
});
