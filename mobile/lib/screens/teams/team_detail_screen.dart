import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/opdesk_repository.dart';
import '../../models/team.dart';
import '../../models/person.dart';
import '../../widgets/states.dart';
import '../../widgets/status_badge.dart';

class TeamDetailScreen extends StatefulWidget {
  const TeamDetailScreen({super.key, required this.teamId});
  final String teamId;

  @override
  State<TeamDetailScreen> createState() => _TeamDetailScreenState();
}

class _TeamDetailScreenState extends State<TeamDetailScreen> {
  Team? _team;
  List<TeamMember>? _members;
  List<Person> _allPeople = [];
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final repo = context.read<OpDeskRepository>();
      final teamResult = await repo.getTeam(widget.teamId);
      final people = await repo.listPeople();
      if (!mounted) return;
      setState(() {
        _team = teamResult.$1;
        _members = teamResult.$2;
        _allPeople = people;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _addMember(String userId) async {
    setState(() => _busy = true);
    try {
      await context.read<OpDeskRepository>().addTeamMember(widget.teamId, userId);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _removeMember(String userId) async {
    setState(() => _busy = true);
    try {
      await context.read<OpDeskRepository>().removeTeamMember(widget.teamId, userId);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showAddMemberSheet() {
    final memberIds = _members!.map((m) => m.id).toSet();
    final candidates = _allPeople.where((p) => !memberIds.contains(p.id)).toList();

    showModalBottomSheet(
      context: context,
      builder: (context) {
        if (candidates.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(24),
            child: Text('Everyone is already on this team.'),
          );
        }
        return ListView.builder(
          shrinkWrap: true,
          padding: const EdgeInsets.symmetric(vertical: 12),
          itemCount: candidates.length,
          itemBuilder: (context, index) {
            final person = candidates[index];
            return ListTile(
              title: Text(person.name),
              subtitle: Text(person.email),
              onTap: () {
                Navigator.pop(context);
                _addMember(person.id);
              },
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_team?.name ?? 'Team')),
      body: _error != null
          ? ErrorState(message: _error!, onRetry: _load)
          : (_team == null || _members == null)
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Code: ${_team!.code}${_team!.departmentName != null ? ' · ${_team!.departmentName}' : ''}',
                            style: TextStyle(color: Colors.grey.shade600),
                          ),
                        ),
                        if (!_team!.active)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(color: Colors.grey.shade200, borderRadius: BorderRadius.circular(999)),
                            child: const Text('Archived', style: TextStyle(fontSize: 11)),
                          ),
                      ],
                    ),
                    if (_team!.description != null && _team!.description!.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text(_team!.description!),
                    ],
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Members (${_members!.length})', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        TextButton.icon(
                          onPressed: _busy ? null : _showAddMemberSheet,
                          icon: const Icon(Icons.person_add_alt, size: 18),
                          label: const Text('Add'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    if (_members!.isEmpty)
                      const EmptyState(title: 'No members yet', description: 'Tap Add to bring people onto this team.')
                    else
                      ..._members!.map((m) => Card(
                            elevation: 0,
                            margin: const EdgeInsets.only(bottom: 8),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: BorderSide(color: Colors.grey.shade200),
                            ),
                            child: ListTile(
                              title: Text(m.name),
                              subtitle: Text('${m.employeeCode ?? '—'} · ${m.role.replaceAll('_', ' ')}'),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  StatusBadge(status: m.status),
                                  IconButton(
                                    icon: const Icon(Icons.close, size: 18, color: Colors.redAccent),
                                    onPressed: _busy ? null : () => _removeMember(m.id),
                                  ),
                                ],
                              ),
                            ),
                          )),
                  ],
                ),
    );
  }
}
