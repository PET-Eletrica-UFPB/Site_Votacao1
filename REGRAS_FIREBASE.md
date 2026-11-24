# Regras do Firebase para professores e notas

As notas dos professores agora ficam no mesmo Realtime Database da feira (`fee20261`), dentro de `urna/multiurna/site`. Para isso funcionar, é preciso **acrescentar** as regras abaixo às que já estão publicadas.

> **Não apague as regras que já existem.** As de `controle` e `dispositivos` são usadas pelas urnas. Só junte o bloco `site` abaixo dentro de `urna` → `multiurna`. Se já existir um bloco `site` (com `projetos`), troque-o por este, que já inclui `projetos`.

## Onde publicar

1. Abra o [console do Firebase](https://console.firebase.google.com/) → projeto **fee20261**.
2. **Realtime Database** → aba **Regras**.
3. Dentro de `"urna"` → `"multiurna"`, coloque o bloco `"site"` abaixo e clique em **Publicar**.

```json
"site": {
  "projetos": {
    ".read": true,
    ".write": "auth != null && auth.uid === 'b2Ejyy4jJCYbx0edNZxB3QAnYuE2'"
  },
  "professores": {
    ".read": true,
    ".write": "auth != null && auth.uid === 'b2Ejyy4jJCYbx0edNZxB3QAnYuE2'"
  },
  "professores_codigos": {
    ".read": "auth != null && auth.uid === 'b2Ejyy4jJCYbx0edNZxB3QAnYuE2'",
    ".write": "auth != null && auth.uid === 'b2Ejyy4jJCYbx0edNZxB3QAnYuE2'"
  },
  "avaliacoes": {
    ".read": "auth != null && auth.uid === 'b2Ejyy4jJCYbx0edNZxB3QAnYuE2'",
    ".write": "auth != null && auth.uid === 'b2Ejyy4jJCYbx0edNZxB3QAnYuE2'",
    "$professor": {
      ".read": "auth != null && auth.uid === $professor",
      "$projeto": {
        ".write": "auth != null && auth.uid === $professor && root.child('urna/multiurna/site/professores/' + $professor + '/projetos/' + $projeto).val() === true",
        ".validate": "newData.hasChildren(['notas', 'media', 'salvoEm']) && newData.child('media').isNumber() && newData.child('media').val() >= 0 && newData.child('media').val() <= 10"
      }
    }
  },
  "formularios": {
    ".read": true,
    ".write": "auth != null && auth.uid === 'b2Ejyy4jJCYbx0edNZxB3QAnYuE2'"
  },
  "inscricoes": {
    ".read": "auth != null && auth.uid === 'b2Ejyy4jJCYbx0edNZxB3QAnYuE2'",
    ".write": "auth != null && auth.uid === 'b2Ejyy4jJCYbx0edNZxB3QAnYuE2'",
    "$tipo": {
      ".validate": "$tipo === 'alunos' || $tipo === 'professores'",
      "$resposta": {
        ".write": "!data.exists() && newData.exists() && root.child('urna/multiurna/site/formularios/' + $tipo + '/aberto').val() === true",
        ".validate": "newData.hasChildren(['enviadoEm', 'respostas']) && newData.child('enviadoEm').val() === now"
      }
    }
  }
}
```

> **Atenção:** no Realtime Database, uma permissão dada em um nível vale para tudo abaixo dele. Se as regras atuais tiverem `".read": true` em `urna` ou `multiurna`, os códigos dos professores ficariam públicos. Nesse caso, tire esse `.read` de lá e coloque `".read": true` só em `controle` e `dispositivos` (que o placar lê).

### O que cada parte garante

| Caminho | Quem lê | Quem grava |
|---|---|---|
| `site/projetos` | todo mundo (site público) | só a conta do PET |
| `site/professores` (nome e projetos de cada professor) | todo mundo (lista do login) | só a conta do PET |
| `site/professores_codigos` (códigos de acesso) | só a conta do PET | só a conta do PET |
| `site/avaliacoes/<professor>` (as notas) | o próprio professor e a conta do PET | o próprio professor, **só nos projetos atribuídos a ele**; a conta do PET pode tudo |
| `site/formularios` (perguntas e se está aberto) | todo mundo (página Inscrições) | só a conta do PET |
| `site/inscricoes/alunos` e `.../professores` (respostas) | só a conta do PET | qualquer visitante pode **criar** uma resposta nova, e só enquanto aquele formulário estiver aberto; ninguém de fora edita nem apaga |

## Contas dos professores

Cada professor cadastrado na Área dos Petianos ganha uma conta no **Firebase Authentication** (login por e-mail e senha, o mesmo provedor que o PET já usa). O e-mail dessa conta é interno, do tipo `prof-…@professores.feira-pet-ufpb.example.com`, e nunca recebe mensagens. O professor só escolhe o nome e digita o código de acesso.

- Se o cadastro de professor der erro de "não está deixando criar contas", confira em **Authentication → Sign-in method** se **E-mail/senha** está ativado. Em **Authentication → Configurações → Ações do usuário**, a opção de **criação de contas (cadastro)** também precisa estar ativa.
- Ao excluir um professor pela Área dos Petianos, a conta dele também é apagada.
