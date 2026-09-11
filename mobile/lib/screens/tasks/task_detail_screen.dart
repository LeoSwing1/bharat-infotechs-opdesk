import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/opdesk_repository.dart';
import '../../core/api_client.dart';

class TaskDetailScreen extends StatefulWidget {
  const TaskDetailScreen({super.key, required this.taskId});

  final String taskId;

  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  Map<String, dynamic>? data;
  bool loading = true;
  bool busy = false;
  final comment = TextEditingController();

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    comment.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final d = await context.read<OpDeskRepository>().getTask(widget.taskId);
      if (mounted) setState(() => data = d);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> act(String action) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await context.read<OpDeskRepository>().transitionTask(
            widget.taskId,
            action,
            comment: comment.text.trim().isEmpty ? null : comment.text.trim(),
          );
      comment.clear();
      await load();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final taskValue = data?['task'];
    final task = taskValue is Map ? Map<String, dynamic>.from(taskValue) : null;
    final status = (task?['status'] ?? '').toString();
    final submissionsValue = data?['submissions'];
    final submissions = submissionsValue is List ? submissionsValue : const <dynamic>[];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Task', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [IconButton(onPressed: loading ? null : load, icon: const Icon(Icons.refresh_rounded))],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : task == null
              ? const Center(child: Text('Task not found'))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(
                      (task['title'] ?? 'Task').toString(),
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      (task['description'] ?? 'No description').toString(),
                      style: TextStyle(color: Colors.grey.shade700, height: 1.4),
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        Chip(label: Text(status.isEmpty ? 'UNKNOWN' : status)),
                        if (task['priority'] != null) Chip(label: Text(task['priority'].toString())),
                      ],
                    ),
                    const SizedBox(height: 18),
                    TextField(
                      controller: comment,
                      maxLines: 4,
                      textInputAction: TextInputAction.newline,
                      decoration: const InputDecoration(
                        labelText: 'Submission / review note',
                        hintText: 'Add a note before submitting or reviewing',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        if (status == 'ASSIGNED')
                          FilledButton.icon(
                            onPressed: busy ? null : () => act('START'),
                            icon: const Icon(Icons.play_arrow),
                            label: const Text('Start'),
                          ),
                        if (status == 'STARTED')
                          FilledButton.icon(
                            onPressed: busy ? null : () => act('SUBMIT'),
                            icon: const Icon(Icons.send),
                            label: const Text('Submit'),
                          ),
                        if (status == 'SUBMITTED' || status == 'UNDER_REVIEW') ...[
                          FilledButton.icon(
                            onPressed: busy ? null : () => act('APPROVE'),
                            icon: const Icon(Icons.check),
                            label: const Text('Approve'),
                          ),
                          OutlinedButton.icon(
                            onPressed: busy ? null : () => act('REJECT'),
                            icon: const Icon(Icons.close),
                            label: const Text('Reject'),
                          ),
                        ],
                        if (status == 'REJECTED')
                          OutlinedButton.icon(
                            onPressed: busy ? null : () => act('REOPEN'),
                            icon: const Icon(Icons.replay),
                            label: const Text('Reopen'),
                          ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    const Text('Submission history', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    if (submissions.isEmpty)
                      Text('No submissions yet.', style: TextStyle(color: Colors.grey.shade600))
                    else
                      ...submissions.map(
                        (item) {
                          final x = item is Map ? Map<String, dynamic>.from(item) : <String, dynamic>{};
                          return Card(
                            elevation: 0,
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              leading: const Icon(Icons.history_rounded),
                              title: Text((x['notes'] ?? x['comment'] ?? 'Submitted').toString()),
                              subtitle: Text((x['createdAt'] ?? '').toString()),
                            ),
                          );
                        },
                      ),
                  ],
                ),
    );
  }
}
