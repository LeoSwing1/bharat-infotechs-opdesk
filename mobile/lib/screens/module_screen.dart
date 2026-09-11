import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/opdesk_repository.dart';
import '../core/api_client.dart';
import 'tasks/task_detail_screen.dart';

class OpDeskModuleScreen extends StatefulWidget {
  const OpDeskModuleScreen({
    super.key,
    required this.title,
    required this.subtitle,
    required this.endpoint,
    required this.icon,
    this.listKey,
    this.actions = const [],
  });

  final String title;
  final String subtitle;
  final String endpoint;
  final IconData icon;
  final String? listKey;
  final List<ModuleAction> actions;

  @override
  State<OpDeskModuleScreen> createState() => _OpDeskModuleScreenState();
}

class ModuleAction {
  const ModuleAction({required this.label, required this.icon, required this.onPressed});
  final String label;
  final IconData icon;
  final Future<void> Function(OpDeskRepository repository) onPressed;
}

class _OpDeskModuleScreenState extends State<OpDeskModuleScreen> {
  bool _loading = true;
  String? _error;
  List<dynamic> _items = const [];
  Map<String, dynamic> _raw = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final data = await context.read<OpDeskRepository>().getRaw(widget.endpoint);
      final key = widget.listKey ?? _findListKey(data);
      final value = key == null ? null : data[key];
      if (!mounted) return;
      setState(() {
        _raw = data;
        _items = value is List ? value : const [];
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Unable to load ${widget.title.toLowerCase()}.';
        _loading = false;
      });
    }
  }

  String? _findListKey(Map<String, dynamic> data) {
    for (final entry in data.entries) {
      if (entry.value is List) return entry.key;
    }
    return null;
  }

  String _label(String key) {
    final spaced = key.replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}');
    return spaced.replaceAll('_', ' ').replaceFirstMapped(RegExp(r'^[a-z]'), (m) => m[0]!.toUpperCase());
  }

  String _value(dynamic value) {
    if (value == null) return '—';
    if (value is bool) return value ? 'Yes' : 'No';
    if (value is List) return '${value.length} items';
    if (value is Map) return '${value.length} fields';
    return value.toString();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: .08),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(widget.icon, color: theme.colorScheme.primary, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  Text(widget.subtitle, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                ],
              ),
            ),
          ],
        ),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded))],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
          children: [
            if (widget.actions.isNotEmpty) ...[
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: widget.actions
                    .map(
                      (action) => FilledButton.icon(
                        onPressed: () async {
                          try {
                            await action.onPressed(context.read<OpDeskRepository>());
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('${action.label} completed')),
                            );
                            await _load();
                          } on ApiException catch (e) {
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
                          }
                        },
                        icon: Icon(action.icon, size: 18),
                        label: Text(action.label),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 16),
            ],
            if (_loading)
              const Padding(
                padding: EdgeInsets.only(top: 90),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              _ErrorCard(message: _error!, onRetry: _load)
            else if (_items.isEmpty && _raw.isEmpty)
              const _EmptyCard(title: 'Nothing to show yet', subtitle: 'Pull down to refresh.')
            else if (_items.isEmpty)
              _SummaryCard(data: _raw, label: widget.title)
            else
              ..._items.map(_itemCard),
          ],
        ),
      ),
    );
  }

  Widget _itemCard(dynamic item) {
    final map = item is Map ? Map<String, dynamic>.from(item) : {'value': item};
    final title = (map['name'] ??
            map['title'] ??
            map['subject'] ??
            map['projectName'] ??
            map['userName'] ??
            map['employeeCode'] ??
            'Record')
        .toString();
    final status = (map['status'] ?? map['priority'] ?? map['kind'])?.toString();
    final details = map.entries
        .where((e) =>
            e.key != 'id' &&
            e.key != 'name' &&
            e.key != 'title' &&
            e.key != 'status' &&
            e.key != 'passwordHash')
        .take(4)
        .toList();

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: widget.endpoint == '/api/tasks' && map['id'] is String
            ? () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => TaskDetailScreen(taskId: map['id'] as String)),
                )
            : null,
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: .08),
                    child: Icon(widget.icon, size: 19, color: Theme.of(context).colorScheme.primary),
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                    ),
                  ),
                  if (status != null) _Pill(text: status),
                ],
              ),
              if (details.isNotEmpty) ...[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: details
                      .map(
                        (e) => Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF7F8FA),
                            borderRadius: BorderRadius.circular(9),
                          ),
                          child: Text(
                            '${_label(e.key)}: ${_value(e.value)}',
                            style: TextStyle(fontSize: 11.5, color: Colors.grey.shade700),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.primary.withValues(alpha: .08),
          borderRadius: BorderRadius.circular(30),
        ),
        child: Text(
          text,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
      );
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.data, required this.label});
  final Map<String, dynamic> data;
  final String label;

  @override
  Widget build(BuildContext context) {
    final entries = data.entries.where((e) => e.value is! List && e.key != 'token').take(10).toList();
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            ...entries.map(
              (e) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 7),
                child: Row(
                  children: [
                    Expanded(child: Text(e.key, style: TextStyle(color: Colors.grey.shade600))),
                    Text(e.value?.toString() ?? '—', style: const TextStyle(fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.title, required this.subtitle});
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        child: Padding(
          padding: const EdgeInsets.all(34),
          child: Column(
            children: [
              Icon(Icons.inbox_outlined, size: 44, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 5),
              Text(subtitle, textAlign: TextAlign.center, style: TextStyle(color: Colors.grey.shade600)),
            ],
          ),
        ),
      );
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            children: [
              const Icon(Icons.cloud_off_rounded, size: 42),
              const SizedBox(height: 10),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Try again'),
              ),
            ],
          ),
        ),
      );
}
