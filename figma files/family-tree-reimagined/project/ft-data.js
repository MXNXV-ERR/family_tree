/* Mehta Family sample dataset — reconstructed from the reference screenshot,
   now organised as MULTIPLE families a person can belong to. Jatin is the
   bridge: his own Mehta line, and the Kapoor line he married into.

   Convention for parent edges: { from: CHILD, to: PARENT, type:'parent' }.
   Spouse edges: { a, b, type:'spouse', status }.
   Attached to window.FT for the prototype. */
(function () {
  const M = (id, name, gender, b, d, extra = {}) => ({
    id, name, gender, birthDate: b || undefined, deathDate: d || undefined, ...extra,
  });
  const S = (a, b, status = 'current') => ({ id: `s_${a}_${b}`, a, b, type: 'spouse', status });
  const P = (child, parent) => ({ id: `p_${child}_${parent}`, from: child, to: parent, type: 'parent' });

  // ============================================================ MEHTA
  const mehtaMembers = [
    // G1
    M('dhirubhai', 'Dhirubhai Mehta', 'male', '1918', '1992', { occupation: 'Cloth merchant', location: 'Ahmedabad', placeOfBirth: 'Nadiad, Gujarat', phone: '', email: '', favoriteQuote: 'A family is the first and the last fortune a man builds.', about: 'Founder of the Mehta textile house. Walked to school barefoot, retired owning three mills.' }),
    M('keshiben', 'Keshiben Mehta', 'female', '1924', '2003', { maidenName: 'Keshiben Patel', location: 'Ahmedabad', placeOfBirth: 'Surat, Gujarat', about: 'Kept the joint family of nineteen fed, every single day, for forty years.' }),

    // G2 — Mehta line
    M('harilal', 'Harilal Mehta', 'male', '1946', '2015', { occupation: 'Mill manager', location: 'Ahmedabad', childhoodStories: 'Learned to read account books before he could read stories.' }),
    M('savitaben', 'Savitaben Mehta', 'female', '1951', '', { maidenName: 'Savitaben Shah', location: 'Ahmedabad' }),
    // G2 — Patel in-law line (separate component)
    M('ramesh', 'Ramesh Patel', 'male', '1948', '2020', { occupation: 'Civil engineer', location: 'Vadodara' }),
    M('kokilaben', 'Kokilaben Patel', 'female', '1955', '', { maidenName: 'Kokilaben Joshi', location: 'Vadodara' }),

    // G3 — Mehta
    M('suresh', 'Suresh Mehta', 'male', '1968', '', { occupation: 'Architect', location: 'Mumbai', phone: '+91 98250 11234', email: 'suresh.mehta@example.com', address: 'Bandra West, Mumbai', placeOfBirth: 'Ahmedabad', about: 'Designs schools across Gujarat. Sketches every building by hand first.' }),
    M('meena', 'Meena Mehta', 'female', '1972', '', { maidenName: 'Meena Trivedi', occupation: 'Schoolteacher', location: 'Mumbai' }),
    M('mahesh', 'Mahesh Mehta', 'male', '1971', '', { occupation: 'Chartered accountant', location: 'Pune' }),
    M('rekha', 'Rekha Mehta', 'female', '1974', '', { maidenName: 'Rekha Desai', location: 'Pune' }),
    M('lata', 'Lata Sharma', 'female', '1975', '', { maidenName: 'Lata Mehta', occupation: 'Doctor', location: 'Delhi' }),
    M('vinod', 'Vinod Sharma', 'male', '1973', '', { occupation: 'Pharmacist', location: 'Delhi' }),
    // G3 — Patel
    M('kiran', 'Kiran Patel', 'male', '1976', '', { occupation: 'Software lead', location: 'Bengaluru' }),

    // G4 — Mehta
    M('anjali', 'Anjali Desai', 'female', '1992', '', { maidenName: 'Anjali Mehta', occupation: 'UX designer', location: 'Bengaluru' }),
    M('sameer', 'Sameer Desai', 'male', '1990', '', { occupation: 'Product manager', location: 'Bengaluru' }),
    M('jatin', 'Jatin Mehta', 'male', '1995', '', { me: true, occupation: 'Software engineer', location: 'Bengaluru', email: 'jatin75b@gmail.com', phone: '+91 99000 75123', address: 'Indiranagar, Bengaluru', placeOfBirth: 'Mumbai', favoriteQuote: 'You are the bridge between everyone who came before and everyone yet to come.', about: 'Building this very family tree, one evening at a time.' }),
    M('neha', 'Neha Mehta', 'female', '1996', '', { maidenName: 'Neha Kapoor', occupation: 'Data scientist', location: 'Bengaluru', placeOfBirth: 'Delhi', email: 'neha.k@example.com', address: 'Indiranagar, Bengaluru' }),
    M('vikram', 'Vikram Mehta', 'male', '1999', '', { occupation: 'Med student', location: 'Mumbai' }),
    M('priya', 'Priya Mehta', 'female', '1997', '', { occupation: 'Journalist', location: 'Pune' }),
    M('rohan', 'Rohan Mehta', 'male', '2000', '', { occupation: 'Chef', location: 'Pune' }),
    M('karan', 'Karan Sharma', 'male', '2002', '', { occupation: 'Student', location: 'Delhi' }),

    // G5
    M('ishaan', 'Ishaan Desai', 'male', '2019', '', { location: 'Bengaluru' }),
    M('aarav', 'Aarav Mehta', 'male', '2020', '', { location: 'Bengaluru' }),
    M('diya', 'Diya Mehta', 'female', '2023', '', { location: 'Bengaluru' }),
  ];

  const mehtaRels = [
    S('dhirubhai', 'keshiben'), S('harilal', 'savitaben'), S('ramesh', 'kokilaben'),
    S('suresh', 'meena'), S('mahesh', 'rekha'), S('lata', 'vinod'),
    S('anjali', 'sameer'), S('jatin', 'neha'),

    P('harilal', 'dhirubhai'), P('harilal', 'keshiben'),
    P('kiran', 'ramesh'), P('kiran', 'kokilaben'),
    P('suresh', 'harilal'), P('suresh', 'savitaben'),
    P('mahesh', 'harilal'), P('mahesh', 'savitaben'),
    P('lata', 'harilal'), P('lata', 'savitaben'),
    P('anjali', 'suresh'), P('anjali', 'meena'),
    P('jatin', 'suresh'), P('jatin', 'meena'),
    P('vikram', 'suresh'), P('vikram', 'meena'),
    P('priya', 'mahesh'), P('priya', 'rekha'),
    P('rohan', 'mahesh'), P('rohan', 'rekha'),
    P('karan', 'lata'), P('karan', 'vinod'),
    P('ishaan', 'anjali'), P('ishaan', 'sameer'),
    P('aarav', 'jatin'), P('aarav', 'neha'),
    P('diya', 'jatin'), P('diya', 'neha'),
  ];

  const mehtaCollab = [
    { id: 'jatin', role: 'Owner', email: 'jatin75b@gmail.com', online: true },
    { id: 'suresh', role: 'Editor', email: 'suresh.mehta@example.com', online: false },
    { id: 'anjali', role: 'Editor', email: 'anjali.d@example.com', online: true },
    { id: 'priya', role: 'Viewer', email: 'priya.m@example.com', online: false },
  ];

  // ============================================================ KAPOOR
  // Neha's maiden family. Jatin appears here as an in-law (married into it).
  const kapoorMembers = [
    // G1
    M('k_brij', 'Brij Mohan Kapoor', 'male', '1932', '2011', { occupation: 'Schoolmaster', location: 'Amritsar', placeOfBirth: 'Lahore', about: 'Partition refugee who rebuilt a school from a single borrowed blackboard.' }),
    M('k_kaushalya', 'Kaushalya Kapoor', 'female', '1938', '2018', { maidenName: 'Kaushalya Sethi', location: 'Amritsar' }),
    // G2
    M('k_rajesh', 'Rajesh Kapoor', 'male', '1964', '', { occupation: 'Bank manager', location: 'Delhi', phone: '+91 98110 22008', email: 'rajesh.kapoor@example.com', placeOfBirth: 'Amritsar', favoriteQuote: 'Save a little, give a little, the rest will follow.' }),
    M('k_sunita', 'Sunita Kapoor', 'female', '1968', '', { maidenName: 'Sunita Malhotra', occupation: 'Homemaker', location: 'Delhi' }),
    M('k_anil', 'Anil Kapoor', 'male', '1966', '', { occupation: 'Army officer (retd.)', location: 'Chandigarh' }),
    M('k_geeta', 'Geeta Verma', 'female', '1970', '', { maidenName: 'Geeta Kapoor', occupation: 'Professor', location: 'Chandigarh' }),
    // G3
    M('neha', 'Neha Mehta', 'female', '1996', '', { me_inlaw: true, maidenName: 'Neha Kapoor', occupation: 'Data scientist', location: 'Bengaluru', placeOfBirth: 'Delhi', email: 'neha.k@example.com' }),
    M('jatin', 'Jatin Mehta', 'male', '1995', '', { me: true, occupation: 'Software engineer', location: 'Bengaluru', email: 'jatin75b@gmail.com', phone: '+91 99000 75123', about: 'Married into the Kapoors in 2021. Keeper of both family trees.' }),
    M('k_arjun', 'Arjun Kapoor', 'male', '1993', '', { occupation: 'Civil servant', location: 'Delhi', placeOfBirth: 'Delhi' }),
    M('k_pooja', 'Pooja Kapoor', 'female', '1994', '', { maidenName: 'Pooja Nair', occupation: 'Architect', location: 'Delhi' }),
    M('k_riya', 'Riya Verma', 'female', '1998', '', { occupation: 'Doctor', location: 'Chandigarh' }),
    // G4
    M('aarav', 'Aarav Mehta', 'male', '2020', '', { location: 'Bengaluru' }),
    M('diya', 'Diya Mehta', 'female', '2023', '', { location: 'Bengaluru' }),
    M('k_kabir', 'Kabir Kapoor', 'male', '2021', '', { location: 'Delhi' }),
  ];

  const kapoorRels = [
    S('k_brij', 'k_kaushalya'), S('k_rajesh', 'k_sunita'), S('k_anil', 'k_geeta'),
    S('jatin', 'neha'), S('k_arjun', 'k_pooja'),

    P('k_rajesh', 'k_brij'), P('k_rajesh', 'k_kaushalya'),
    P('k_anil', 'k_brij'), P('k_anil', 'k_kaushalya'),
    P('neha', 'k_rajesh'), P('neha', 'k_sunita'),
    P('k_arjun', 'k_rajesh'), P('k_arjun', 'k_sunita'),
    P('k_riya', 'k_anil'), P('k_riya', 'k_geeta'),
    P('aarav', 'jatin'), P('aarav', 'neha'),
    P('diya', 'jatin'), P('diya', 'neha'),
    P('k_kabir', 'k_arjun'), P('k_kabir', 'k_pooja'),
  ];

  const kapoorCollab = [
    { id: 'k_rajesh', role: 'Owner', email: 'rajesh.kapoor@example.com', online: false },
    { id: 'neha', role: 'Editor', email: 'neha.k@example.com', online: true },
    { id: 'jatin', role: 'Editor', email: 'jatin75b@gmail.com', online: true },
  ];

  // ============================================================ FAMILIES
  const families = [
    {
      id: 'mehta', name: 'Mehta Family', mono: 'M', color: '#8f8bff',
      kind: 'Your bloodline', role: 'Owner',
      region: 'Ahmedabad · Gujarat', established: '1918', surname: 'Mehta',
      owner: 'jatin75b@gmail.com', inviteCode: 'MEHTA-7K2X',
      summary: 'A Gujarati textile family that grew from three mills in Ahmedabad into five generations spread across Mumbai, Pune, Delhi and Bengaluru.',
      members: mehtaMembers, relationships: mehtaRels, collaborators: mehtaCollab,
    },
    {
      id: 'kapoor', name: 'Kapoor Family', mono: 'K', color: '#ff8caf',
      kind: 'Married in · Neha\u2019s side', role: 'Editor',
      region: 'Amritsar · Punjab', established: '1932', surname: 'Kapoor',
      owner: 'rajesh.kapoor@example.com', inviteCode: 'KAPOOR-3M9P',
      summary: 'A Punjabi family that began with a refugee schoolmaster in Amritsar. Jatin joined it in 2021 when he married Neha.',
      members: kapoorMembers, relationships: kapoorRels, collaborators: kapoorCollab,
    },
  ];

  const treeMetaFor = (f) => ({ name: f.name, owner: f.owner, inviteCode: f.inviteCode });

  window.FT = {
    families,
    treeMetaFor,
    // back-compat: top-level points at the first family
    members: families[0].members,
    relationships: families[0].relationships,
    collaborators: families[0].collaborators,
    treeMeta: treeMetaFor(families[0]),
  };
})();
