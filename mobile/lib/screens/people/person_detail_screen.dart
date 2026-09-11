import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/auth_provider.dart';
import '../../core/opdesk_repository.dart';
import '../../models/person.dart';
import '../../widgets/states.dart';
import '../../widgets/status_badge.dart';

class PersonDetailScreen extends StatefulWidget {
  const PersonDetailScreen({super.key, required this.personId});
  final String personId;

  @override
  State<PersonDetailScreen> createState() => _PersonDetailScreenState();
}

class _PersonDetailScreenState extends State<PersonDetailScreen> {
  Person? _person;
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
      final person = await context.read<OpDeskRepository>().getPerson(widget.personId);
      if (!mounted) return;
      setState(() => _person = person);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _toggleStatus() async {
    if (_person == null) return;
    final nextStatus = _person!.status == 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setState(() => _busy = true);
    try {
      final updated = await context.read<OpDeskRepository>().setPersonStatus(widget.personId, nextStatus);
      if (!mounted) return;
      setState(() { _person = updated; _busy = false; });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final canDeactivate = user?.canManagePeopleByDefault ?? false;

    return Scaffold(
      appBar: AppBar(title: Text(_person?.name ?? 'Person')),
      body: _error != null
          ? ErrorState(message: _error!, onRetry: _load)
          : _person == null
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_person!.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 4),
                              Text(
                                _person!.designation ?? _person!.role.replaceAll('_', ' '),
                                style: TextStyle(color: Colors.grey.shade600),
                              ),
                              const SizedBox(height: 10),
                              StatusBadge(status: _person!.status),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    _Field('Employee ID', _person!.employeeCode ?? '—', mono: true),
                    _Field('Email', _person!.email),
                    _Field('Phone', _person!.phone ?? '—'),
                    _Field('Role', _person!.role.replaceAll('_', ' ')),
                    _Field('Employment type', _person!.employmentType ?? '—'),
                    _Field('Team', _person!.teamName ?? '—'),
                    _Field('Department', _person!.departmentName ?? '—'),
                    _Field('Joining date', _person!.joiningDate ?? '—'),
                    if (canDeactivate) ...[
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: _busy ? null : _toggleStatus,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: _person!.status == 'ACTIVE' ? Colors.red.shade700 : const Color(0xFF111827),
                            side: BorderSide(color: _person!.status == 'ACTIVE' ? Colors.red.shade200 : Colors.grey.shade300),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: Text(_busy
                              ? 'Saving…'
                              : (_person!.status == 'ACTIVE' ? 'Deactivate' : 'Reactivate')),
                        ),
                      ),
                    ],
                  ],
                ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field(this.label, this.value, {this.mono = false});
  final String label;
  final String value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: TextStyle(fontSize: 11, color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
          const SizedBox(height: 3),
          Text(value, style: TextStyle(fontSize: 14, fontFamily: mono ? 'monospace' : null)),
        ],
      ),
    );
  }
}
