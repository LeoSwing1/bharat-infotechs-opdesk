import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/auth_provider.dart';
import '../../core/opdesk_repository.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});
  @override State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final input = TextEditingController();
  final search = TextEditingController();
  List<dynamic> conversations = <dynamic>[];
  List<dynamic> people = <dynamic>[];
  List<dynamic> messages = <dynamic>[];
  String? activeId;
  Timer? refreshTimer;
  bool loading = true;
  bool sending = false;
  String peopleQuery = '';

  @override
  void initState() {
    super.initState();
    load();
    refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      await loadConversations(silent: true);
      if (activeId != null) await loadMessages(activeId!, silent: true);
    });
  }
  @override void dispose() { refreshTimer?.cancel(); input.dispose(); search.dispose(); super.dispose(); }

  Future<void> load({bool silent = false}) async {
    if (!silent && mounted) setState(() => loading = true);
    try {
      await Future.wait([loadConversations(silent: true), loadPeople()]);
      if (activeId == null && conversations.isNotEmpty) activeId = conversations.first['id']?.toString();
      if (activeId != null) await loadMessages(activeId!, silent: true);
      if (mounted) setState(() => loading = false);
    } on ApiException catch (e) {
      if (mounted) { setState(() => loading = false); if (!silent) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message))); }
    }
  }

  Future<void> loadConversations({bool silent = false}) async {
    try {
      final d = await context.read<OpDeskRepository>().listConversations();
      if (!mounted) return;
      setState(() => conversations = (d['conversations'] as List?)?.toList() ?? <dynamic>[]);
    } catch (e) {
      if (!silent && mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> loadPeople() async {
    final d = await context.read<OpDeskRepository>().getRaw('/api/people', query: {'status': 'ACTIVE'});
    if (!mounted) return;
    final me = context.read<AuthProvider>().user?.id;
    setState(() => people = ((d['people'] as List?)?.toList() ?? <dynamic>[]).where((p) => p is Map && p['id']?.toString() != me).toList());
  }

  Future<void> loadMessages(String id, {bool silent = false}) async {
    try {
      final d = await context.read<OpDeskRepository>().listMessages(id);
      if (!mounted || activeId != id) return;
      setState(() => messages = (d['messages'] as List?)?.toList() ?? <dynamic>[]);
    } catch (e) {
      if (!silent && mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> selectConversation(String id) async {
    setState(() { activeId = id; messages = <dynamic>[]; });
    await loadMessages(id);
  }

  Future<void> send() async {
    final id = activeId;
    final body = input.text.trim();
    if (id == null || body.isEmpty || sending) return;
    setState(() => sending = true);
    try {
      await context.read<OpDeskRepository>().sendMessage(id, body);
      input.clear();
      await loadMessages(id);
      await loadConversations(silent: true);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally { if (mounted) setState(() => sending = false); }
  }

  String label(Map<String,dynamic> c) {
    final n = c['name']?.toString().trim();
    if (n != null && n.isNotEmpty) return n;
    final members = c['members'];
    if (members is List) {
      final names = members.whereType<Map>().map((m) => m['name']?.toString() ?? '').where((n) => n.isNotEmpty).join(', ');
      if (names.isNotEmpty) return names;
    }
    return c['type']?.toString() ?? 'Conversation';
  }

  Future<void> newChat({String? personId}) async {
    String type = personId != null ? 'DIRECT' : 'DIRECT';
    String name = '';
    final selected = <String>[];
    if (personId != null) selected.add(personId);
    String query = '';
    String? error;
    final created = await showModalBottomSheet<Map<String,dynamic>>(
      context: context, isScrollControlled: true, showDragHandle: true,
      builder: (sheetContext) => StatefulBuilder(builder: (context, setModal) {
        final filtered = people.where((p) {
          final n = '${p['name'] ?? ''} ${p['employeeCode'] ?? ''} ${p['email'] ?? ''}'.toLowerCase();
          return n.contains(query.toLowerCase());
        }).toList();
        return SafeArea(child: Padding(
          padding: EdgeInsets.fromLTRB(18, 8, 18, MediaQuery.of(context).viewInsets.bottom + 18),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Start a chat', style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: ['DIRECT', 'GROUP', 'SPACE'].map((k) {
                return ChoiceChip(
                  label: Text(k),
                  selected: type == k,
                  onSelected: (_) {
                    setModal(() {
                      type = k;
                      selected.clear();
                    });
                  },
                );
              }).toList(),
            ),
            if (type != 'DIRECT') ...[
              const SizedBox(height: 10),
              TextField(onChanged: (v) => name = v, decoration: const InputDecoration(labelText: 'Name', border: OutlineInputBorder())),
            ],
            const SizedBox(height: 10),
            TextField(onChanged: (v) => setModal(() => query = v), decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search people', border: OutlineInputBorder())),
            const SizedBox(height: 8),
            SizedBox(height: 300, child: ListView(children: filtered.map<Widget>((p) {
              final id = p['id']?.toString() ?? '';
              final checked = selected.contains(id);
              return CheckboxListTile(value: checked, dense: true, title: Text(p['name']?.toString() ?? 'Person', style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('${p['employeeCode'] ?? p['email'] ?? ''} · ${p['role'] ?? ''}'), onChanged: (_) => setModal(() { if (type == 'DIRECT') { selected..clear()..add(id); } else if (checked) { selected.remove(id); } else { selected.add(id); } }));
            }).toList())),
            if (error != null) Text(error!, style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 8),
            SizedBox(width: double.infinity, child: FilledButton(onPressed: () async {
              if (selected.isEmpty) { setModal(() => error = 'Select at least one person.'); return; }
              try {
                final d = await context.read<OpDeskRepository>().createConversation(type: type, memberIds: selected, name: name);
                if (sheetContext.mounted) Navigator.of(sheetContext).pop(Map<String,dynamic>.from(d['conversation'] as Map));
              } on ApiException catch (e) { setModal(() => error = e.message); }
            }, child: const Text('Start conversation'))),
          ]),
        ));
      }),
    );
    if (created != null && mounted) { await loadConversations(silent: true); final id = created['id']?.toString(); if (id != null) await selectConversation(id); }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.read<AuthProvider>().user?.id;
    final active = conversations.cast<dynamic?>().where((c) => c?['id']?.toString() == activeId).firstOrNull;
    final filteredPeople = people.where((p) => '${p['name'] ?? ''} ${p['employeeCode'] ?? ''}'.toLowerCase().contains(peopleQuery.toLowerCase())).take(6).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Chats', style: TextStyle(fontWeight: FontWeight.w900)), actions: [IconButton(onPressed: () => newChat(), icon: const Icon(Icons.add_comment_rounded)), IconButton(onPressed: () => load(), icon: const Icon(Icons.refresh_rounded))]),
      body: loading ? const Center(child: CircularProgressIndicator()) : Column(children: [
        SizedBox(height: 82, child: conversations.isEmpty ? Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 8), child: Text('No conversations yet. Start one below.', style: TextStyle(color: Colors.grey.shade600))) : ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.fromLTRB(12, 10, 12, 8), children: conversations.map<Widget>((raw) {
          final c = Map<String,dynamic>.from(raw as Map); final id = c['id']?.toString() ?? ''; final unread = int.tryParse(c['unreadCount']?.toString() ?? '0') ?? 0;
          return Padding(padding: const EdgeInsets.only(right: 7), child: ChoiceChip(label: Row(mainAxisSize: MainAxisSize.min, children: [Text(label(c), overflow: TextOverflow.ellipsis), if (unread > 0) ...[const SizedBox(width: 5), CircleAvatar(radius: 9, child: Text('$unread', style: const TextStyle(fontSize: 9)))] ]), selected: activeId == id, onSelected: (_) => selectConversation(id)));
        }).toList())),
        if (conversations.isEmpty) ...[
          Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: TextField(onChanged: (v) => setState(() => peopleQuery = v), decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Find someone in your organization', border: OutlineInputBorder()))),
          const SizedBox(height: 6),
          Expanded(child: ListView(children: filteredPeople.map<Widget>((p) => ListTile(leading: CircleAvatar(child: Text((p['name']?.toString() ?? '?')[0].toUpperCase())), title: Text(p['name']?.toString() ?? 'Person', style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('${p['employeeCode'] ?? p['email'] ?? ''} · ${p['role'] ?? ''}'), trailing: const Icon(Icons.chevron_right_rounded), onTap: () => newChat(personId: p['id']?.toString()))).toList())),
        ] else ...[
          Expanded(child: activeId == null ? const Center(child: Text('Select a conversation')) : ListView.builder(reverse: true, padding: const EdgeInsets.fromLTRB(14, 8, 14, 12), itemCount: messages.length, itemBuilder: (context, index) {
            final m = messages[messages.length - 1 - index] as Map; final mine = m['senderId']?.toString() == me;
            return Align(alignment: mine ? Alignment.centerRight : Alignment.centerLeft, child: Container(constraints: const BoxConstraints(maxWidth: 330), margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: mine ? Theme.of(context).colorScheme.primary : Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.grey.shade200)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [if (!mine) Text(m['senderName']?.toString() ?? '', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800)), Text(m['body']?.toString() ?? '', style: TextStyle(color: mine ? Colors.white : Colors.black87)), const SizedBox(height: 3), Text(_time(m['createdAt']), style: TextStyle(fontSize: 9, color: mine ? Colors.white70 : Colors.grey))])));
          })),
        ],
        SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(10, 8, 10, 10), child: Row(children: [Expanded(child: TextField(controller: input, enabled: activeId != null, textInputAction: TextInputAction.send, onSubmitted: (_) => send(), decoration: const InputDecoration(hintText: 'Message…', border: OutlineInputBorder()))), const SizedBox(width: 7), IconButton(onPressed: activeId == null || sending ? null : send, icon: sending ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.send_rounded))]))),
      ]),
    );
  }

  String _time(dynamic v) { final d = DateTime.tryParse(v?.toString() ?? '')?.toLocal(); if (d == null) return ''; return '${d.hour.toString().padLeft(2,'0')}:${d.minute.toString().padLeft(2,'0')}'; }
}

extension _FirstOrNull<T> on Iterable<T> { T? get firstOrNull => isEmpty ? null : first; }
