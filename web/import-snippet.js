/* Azure Calculator CSV Bridge. Run only in the official calculator's DevTools.
 * Uses Microsoft frontend actions observed and round-trip tested on 2026-10-22.
 * Checkpoints use the tool's own localStorage namespace. No credential access,
 * direct Microsoft storage writes, account Save, Share or Delete operations.
 */
(function (global) {
  "use strict";
  const SITE_BUILD = "20261019-0214-20261019-2100-186570892";
  // Observed in this pinned site's openSavedOrSharedEstimate limit, not a resource-count limit.
  const OPEN_ESTIMATE_TABS = 10;
  const CHECKPOINT_PREFIX = "calcbridge:v2:";
  const runtime = global.__AzureCalcBridgeRuntimeV2 || {busy: false, job: null, item: null, report: null, pauseRequested: false};
  global.__AzureCalcBridgeRuntimeV2 = runtime;
  const TEMPLATE_HASHES = {
    "virtual-machines": "1d3cfd21df44933521b7bd49472b8df28eb8f92eade301310fa1b648e17c2cba",
    "managed-disks": "a84ed8d497412d56465ec3c2dc9fb10c43e957b63c98f11e42b63776947e23d6"
  };
  // Generated from the pinned, live-tested Microsoft service catalog.
  const NATIVE_TEMPLATE_HASHES = {
    "virtual-machines": "b059254d71c248b2fca4ec4c08321f1355d06972a3867bdadca3bfae95b0a3c3",
    "storage": "b5715ae1ab5b40612c69f8b9a5c48bf2091bd0c97b3fe3c1146c24598507ce46",
    "azure-sql-database": "4ee08ccf93303c89952d2f136c2da3e2db3fbec696ddf7ea08af8e29dc86ddf6",
    "app-service": "72af91bce0e824c5e8ab12712ff7e98caf04e40fb2018994ce7dbe3d50da5e0b",
    "cosmos-db": "72fe779b7542bc071ff8b05899ba7ef224d002ec5981893a0ba4595f90f9976d",
    "kubernetes-service": "ca1e9e76f7ac2df98b174eb1baa75bd24c5d762355c60450049973527d68d544",
    "functions": "35051a4f23d641e6b5ab6d9d251fa9ebe7e9fe6f2b767cbad6b46e461422e752",
    "cognitive-services": "3697b124eaa3313e128cb317551fb5cb48aa25366db08ea57b552593d2cc3f5b",
    "cost-management": "b376cc37daa9ff1d544118a984ded405570e66620c13cbb28d8a11affdc02581",
    "virtual-machine-scale-sets": "81b129d252d5cce74736c500fdeee8739707582c3ffab2ef32760cea48ec97f4",
    "service-fabric": "db3ec17c5b416f14ba5522db0aceb85788bd28806b6e005408e5a50bdb275e10",
    "container-instances": "f25faa88381a7d191944a11272b82a2eed441ed42c7f7013b1aec3f7ba0f58a5",
    "batch": "e3f2f63dc4aca729ca0ee2a942e6fc377318fc0ed0c8b3e46a52ff17a1b14488",
    "cloud-services": "6c0c403f041268bcebaffde9d09d66e56d73782b5ee47f6cace0f884544d765a",
    "azure-vmware": "2119e6bcc1d221a593b5ff29843c09d3e341cf920b13c26570654462878843d3",
    "virtual-desktop": "c6f8f8967a05258f22820af2a33d12a95d7db7bcde759e725cf78186fd8da12c",
    "spring-apps": "853a630d41d311505021a044fd810da70b2aa27059825b4830dd2b25053a993e",
    "virtual-machines\\dedicated-host": "d6c53938b8d91055ba1054ec0d480efd54bd9036d07cf70ccbd9703f2323e5c7",
    "nutanix-on-azure": "94faff381af5b46ab0706039e01218ebd60e9537b60aedc3191b821b680911e1",
    "virtual-network": "3b831ca76f4f8a45f73da13d5d727071357f1dc1c0c2382c87af4be555c359ba",
    "virtual-network-manager": "2ce45edcfa1298e50f15674714ac64f731938f57b1e2f4b9dd67b247d3d2196f",
    "load-balancer": "8ec73c81e8bb9fd6780ffcee6a272c15ab3e0caa3b4be8fc01f8e4368b345d9c",
    "application-gateway": "fbb89763ac4518d05876d0cc043f93a4b55d7045f043b3def6c85b0ae6c9c539",
    "vpn-gateway": "c4077a8ead9df5f631b59b4daf37ccb8b02775fc34bb57bf39abdc88fea7d8fb",
    "dns": "cce45c872baa4e912104ff618224d736e72a95bb52d15872e4a53c410f490769",
    "cdn": "4a483bfd148db4fea404918d028dc7c13d7b2f9c133b4bf3bd7231d0c99e2dcb",
    "ddos-protection": "2fe14c0de79d7677d4c3a630742fadd131b35e1c00ab110375645c5cdb387ecc",
    "traffic-manager": "de044932afbd74736efc25a192d96a616b3f3b2e53dedf48137d677b55ccafb0",
    "expressroute": "21a96d805dbea33094d63b974ac3422ff7ba091cf890a84bd9c78bab34b83259",
    "network-watcher": "b7865e599a088674e2dadc5a3149e7ead55f10e180b2c3caa6abc890d41d9479",
    "bandwidth": "a754f55dafb95be50699ca06a671035223d88ee550a30f96cbb52dfc6f05eb78",
    "ip-addresses": "33dc1f25941897359810b2197e92c1a78824ff62160a71a5352636b1fbd565d5",
    "azure-firewall": "3dbea8893bc602ff2425965d6eb36b0ec64e96b0080fbfdd2f005811a8b7fa13",
    "virtual-wan": "babad175c26e740d792b45c698a2c3d47ce313a0ecebe2e31d74ad6d334697eb",
    "azure-bastion": "8412b2c56f766d11f675fa161eac65308f74a3f77433a40106f559a533f851e8",
    "private-link": "7a279c9026f7032d124ebae31b5a585a2922a756ff4b125cd529602b55c2e531",
    "firewall-manager": "e9039fc4b57a6e85e77baaf3cba379504f05c5b302ff0d0c9fea48e2b92e7a64",
    "frontdoor-standard-premium": "bfcddc7145472da3f5e7754c4e0012333dc781caa1e8d77298d83975e1f369a4",
    "route-server": "17242a2ee24d565efd5ca5ec469b6712633ba6ec8bbcd304cc9c0c31f2c7bd4f",
    "communications-gateway": "9196de1de79ab9f96c8367f7f74e6500ce51d41509a1fd0dfc48ffd0662f2a89",
    "virtual-network-nat": "8a8f998fd0a3ec128833969ca1c618ff09df9fa13526c1a760a5fbd8f9f0a186",
    "advanced-container-networking-services": "cebed2b7724a2db941974bcd6d010464e9dc1b6a3161a10053e5fce111f46482",
    "storage-actions": "c36c2017a8f7adfe351061de605cdc98cfc25fb69816c3a915b948e4f8c043ba",
    "azure-virtual-enclaves": "d4ff60ab038562b6f35aa057eb92ccce79b1f4c407b8b089f4db060fa3ff5e73",
    "databox": "ca7ae3918b7c388e21d4aa381db3c04d3f36f5361d79137387e3f99b24d02e38",
    "data-share": "c764596432ba46d4d6975e2ac37f3709d1514b5fd2690bad5a0c07e96833423a",
    "netapp": "f5e35cedf8c08661ae78d55528035e8fce1f1fdae4c9ddab7fe6dc84560d7a73",
    "azure-stack-edge": "4a508111c04ea5b105b376a38e00b51735881410a1b875d11fad59ca0ecc6ae0",
    "managed-disks": "151d3159535d1994c44e6125c17d389ca50c63dffc45f9982be11caa9437e3c6",
    "confidential-ledger": "751583659afa2c4b9faa5cc9861969d61626a07f1fea4548b0dedff67b12d16f",
    "azure-elastic-san": "308447c491ff717e704757505d3d593461e2137f3b421027cb5b5e016aaf3f1f",
    "managed-lustre": "be537a14f2a5f3f73212c8e388125d346ddc2bed7b71c1aa82d31f8aa5cd4fb7",
    "storage\\files": "ff6b6bc1361947c4597a0cca6a26307911fb7331100d27bac5b849c2521ea615",
    "container-storage": "50e8b126451dbadbc4461e7269debdb2d6f857c8f5d429115f7054be04ff48f9",
    "azure-storage-discovery": "758b0f73d2b45fe1651c537875b67e69d56dc0949c5e99b0852e17449652bcba",
    "api-management": "646006b3205096c82dbd72cc9fc4e502e1b065f9907dab7d3545a0bd9917de1a",
    "search": "6d6cf1815a592e9bd4aaddf6b5d75385ff3ca106f80d0a08d046de1ce76fe88a",
    "signalr-service": "c4e6196c320c49665f7bb67dfb7e063c0d1253816f93a987fc47b63d93b97406",
    "web-pubsub": "b13e07285c439f9d341dbb4b6a3c6032f0ddd52efd1a14701550bf56d029b1ae",
    "notification-hubs": "51d15cce1be041f1a9dff979f095431cfdffad7b99eb891d0a74e57f5b0a7493",
    "app-service\\static": "8fa0478c211c5381e7b6dca63b1d9ce133b28913ca8c3aca5eb5c266d6795ca1",
    "communication-services": "54430382676ab571c70c58e1c0a0f1609645f90f7fbeba732cd4e8caf7160c31",
    "fluid-relay": "4827dd6dcfdf22825258544dd6cd491428daf77484c48c2e491f9cb781af895c",
    "azure-maps": "c6b9d0891d4fccd81fdcf8145c5074e9865c8feb93ed00382e5640e779ed5ebf",
    "remote-rendering": "a229b00101cdd862dafb3ff3cfb2328cc3eb159e48c432c477b9ac137a34e5b1",
    "container-registry": "6301ebbdf3e8bc625310a40437a7597a1e153a6a60f0e7386a14ad5568df713e",
    "openshift": "248c33a4a4c57d251ec9892eed47caed48e601e25144329138b67fe751c506cf",
    "container-apps": "bc5b8ed944d19c3446b95828341ae4fbc2e05ba03226864c09bf9276f6165b1e",
    "aks-ee": "6a8e6493c65862ad5079cc85831187a5c55749bb1cec70aa2055e29ea4f5e168",
    "documentdb": "2a009bfad0db444c47fe68f0e4c75b63555a211dfeb8e318188787773964dc6c",
    "mysql": "4d68044996a024b6570856c06aa377abd89dc6c1cafdbb3608d91fc6d4c15ab8",
    "mariadb": "f4f8502804f3eca9fcf1b9210b3a333b04a007224561337dc0f326cff405baad",
    "postgresql": "bc4bd3ef0f4ad6cdd1d804f204dd2aec72abacc1c13ed7d942d809385c450149",
    "synapse-analytics": "097e5606be5caceb8f09684612c30744d18b10d4483f07da42a01168ee4f577d",
    "database-migration": "b9fc55514c46e5a75c0396549559e4ab5b52276aa5c7d9e8986e91b0e90f0471",
    "redis-cache": "a68597d9e15a3bd009f3fe31ba82aec3516c9ff8191df4aa840d6c2dee42bc3d",
    "health-data-services": "4411eea0d72f20a4cd1942a05e9e18a8e29a6675032e0149c275ebcdc593c53d",
    "azure-sql": "71a0057249ff3a14d1aba58567983ff783b5daf9e15e877e9c931d0260873720",
    "managed-instance-apache-cassandra": "d3b7bf5af7399d5fbbfafdc9d91a22ad1f083bdbfaa57c9a11ffba7bdcc37b63",
    "managed-redis": "172ce14674de9702e3bbccd550b9ed046b52b8f223d4ea46835e74ada2adfc8a",
    "horizondb": "95ea1a5b964437670c0744380f8275d80ef482ee286863aba9add913d3dfb3aa",
    "microsoft-fabric": "bacac0cad1c861827b9213e04a6a0493f8044a07758aba3c4c7618a8453a1a9c",
    "databricks": "55312ac9f11689dae3fc247bc9db09ad496505966a176dcbd760ce42425784e3",
    "hdinsight": "55e3f2d4b0084bdb4fe126b46e5d729843874a9fd354062afd64d216c44efad6",
    "machine-learning-service": "cf56e9a931385238ef39a1c03b5f71b5ffb40afaee5d79e31692aeffe926c19c",
    "stream-analytics": "7136c19f7758932ec31143811383fffe44bae883e487877078f6c04d18f9778d",
    "event-hubs": "13bccfc63af36c069dfc5258b20369bb41273f4715189ce56b04d137551b7aa3",
    "power-bi-embedded": "0fdd94b511a185c87ff6fa06dd2ad40b163aa2174b2f4f5e3b5a54324cc8c300",
    "analysis-services": "bc071d773a619a4f31f604077476e0708de37bc73544d523baccb884cd4649d5",
    "data-catalog": "22a4aeec7e029168ce770958e2634d6b589262df8855be925802f9d0cd2c90b5",
    "bot-services": "e110901782e759ea7bcb1a42609583b447558e42bd6cd0cdb217e7c569fc2bd1",
    "data-explorer": "5e70e1a37c2624516fa727a2a42a498136ca9063567270e15ce290122103876a",
    "data-factory": "75a452d07f1f0df40f6750042c3c551af9b2bbcd94385889dc9740a4ce22530c",
    "purview": "c170dc6319d62b615b11a994f6fad2c1233df25dfe351f462d0d38b0750be72d",
    "chaos-studio": "f7ce5d21495412c7cb50581d3e6f71973ed4e88d6e33b7c76362bae6bf99ffbc",
    "managed-grafana": "68f47ef28ebaed6f8c42dd158485edf518a7342ac362266bbcd9789aea994985",
    "graph-data-connect": "f5cec87759aa478f4febc8a0a9c41c1b1ef7dca86b0e67c4afe679096cc71e19",
    "genomics": "982ef0217174137fe10f675c86426fde3c4e338a33b25b0d391550ce67e40572",
    "machine-learning-studio": "18ee2f651d7a733c90b6eb5c990717c0dc45d16bad02881ac0fb4fa1f12254b1",
    "open-datasets": "3b20e16885de8aebdb994e4af1e0d71fb658c53280dec23748bfe06f1eb2cbce",
    "openai-service": "df874e0e53c63341445a8d445ee5e308ba335878627cc7daf024c6c4d16bb979",
    "healthcare-agent-service": "856c8215500caadfd593d93f90a20f7e659a73e0b5e624db1914bb5f7435a1a9",
    "form-recognizer": "8fbd27db3ba43b48f25050500a5d85f4ba40bde2cf411d68d5c5061acc42265c",
    "video-indexer": "58be22e9758ab527641f51cd47a9f3c05d43cbefa1087a4fa1ba05357e73dfbf",
    "content-understanding": "233219966d731420ccfe08bebbd68a284e98048a83f7002ed5cf1ded4345f24a",
    "sre-agent": "4aaa4bb2c5f543920650bdfa0d53058ee44fec871b8c979d81db6bab38673006",
    "planetary-computer-pro": "dadb46dd51a8386235eda4e9c8f49f167990a44ba2afe160ed900cb56d2944ce",
    "iot-hub": "718fafc2d9335bfd77dd8f93f7c73147836100a87a5f87eb3d494e45d8866cde",
    "iot-edge": "76e58706ac552ebe14c1e745177e4433caff24327d6a8196a2ae1042e1ea92c2",
    "iot-central": "c23d3db3ab2d53cfc9aa41ca66c5878aeaf5f729b55137aab85fe662e21c9e96",
    "digital-twins": "e2d7f12914f0f0102edd7754907f4035719080dbc3e701dfe2631ba3fdd47f05",
    "time-series-insights": "91186d50c42905793ab515a023f6341838ba28bec0b6dde377ae3c3a4b439be7",
    "event-grid": "2b001aa3035ded443c100562322737944f02e801c60f15d5e7eed6814a9534da",
    "logic-apps": "ea2d0a5f74a69b44b307af2c02a1cd70699ee7cb72dd9b7c053abc79280dca91",
    "windows-10-iot-core": "9da8317095728b8708026f646c80c7b849e445a0e2e229607009b1f93aaf46b3",
    "azure-sql-edge": "2d302b4a8eb1c353d2add0156ffaa1c5a243a971352e699a73a616fa03013b92",
    "iot-operations": "3094d6f1a2b7d5e55daf4b3ec103dc2e477fbcb04c196e09904e4f93ae27655d",
    "service-bus": "4152b563a2b83b074615d19a33f70b5e5e4159ff1f2d000a0f26a07b195ee258",
    "energy-data-services": "704a7d827d388d93eb7973da38b6519b90f448944475ac573dc73683e3440d5a",
    "active-directory": "ee62f6a35e382afb5e4421d93d8d55076ac8f3a6295c188c7749cd7739c46c19",
    "active-directory-b2c": "aec1288c686d4cd0d3160b29a3581910b4605ad124e89b0607f5196a28ce8b8a",
    "microsoft-entra-external-id": "aef976ee1b35e66723b994469b7e429a72bfe2ec071a4712ab8d3da384a726ef",
    "defender-for-cloud": "d216263ff5b73a159093f7cdda31ce21565c9073d8525478a58f542462e589c8",
    "azure-sentinel": "818b2216559650f9795a644767a031f71d054253ef81f0527ee589ef3577a7a3",
    "key-vault": "3925867094373494ce748efd10b272c5d4f6006220dd5c609e0a318bfda98fe6",
    "azure-dedicated-hsm": "37a640416cb45b84567d604786329dd3a1bf8714b8e7811150b15468bef1c9da",
    "defender-easm": "0f7b9e40f9706c0c9001912720439e37e3470ff8741d6501206d15a3c2e4edb2",
    "microsoft-security-copilot": "c544cf60b95f1e34dca0cb446c1ca85f9ec307453f24548626bf0b30f86ef83b",
    "artifact-signing": "7f059a7d58289d3691d883d5cd69afbda8929270fe9434aad1ae282b29ff2c9f",
    "azure-cloud-hsm": "7f3f7bff9e53f9a152c33fd045a08d9049f2450c89b1b5acafc84d75c4e705f2",
    "extended-security-updates": "32c5cd3fb8a0a1d067f71df091aee1dffb9442cef18599fc648787618b20a9be",
    "microsoft-defender-isoc": "0d6af1f01792a6fb5f36521f123e16e95652ff950345ced235944dec5f978f12",
    "azure-devops": "2326655511cfe6dd5e6a110f78da390d0e3ede3ad9d1da1f132f6a912524b5cd",
    "lab-services": "f80aea7554ca42a00a1e940b52cdf3aafd610895de69ba05ed388eeffddcaaaf",
    "app-configuration": "99721737774703b047b1cba58ae44240fae845a3b3740fe9eb8201feb21a5ffb",
    "githubenterprise": "a8dbc8e2448f1ae8005889c03c692e634a3e152a1778d3f35c08fbd9c20caa26",
    "monitor": "5f99124e5fdbce92c97750ba26a81cb0679da12a1d84d7242d66328206de747b",
    "load-testing": "2fb6a79bd5071601c4ab14d94662bb587bfa34b0eced1ae7a56ae924e3173021",
    "advisor": "3b47c25acd2182f954bc73b880e7c5b4254ea23d48bbf3a07d4ad59464676952",
    "backup": "78550564e56ca81b9f25eca9860618b4c11b1a1b3282e723887aacb72ddb2bf7",
    "azure-policy": "fa93905e9d470f5778781ecd0c8c61bddab2c7b31e056f287c7ee21f6590923e",
    "site-recovery": "7716ca4e99a7a251794697fe0f35d2d72feafcd79e453b09e7a027df7f38e2d8",
    "automation": "fafb5177bb4779e23917a8f306d281c2c80afc4af3515b821ff6c2b375860d77",
    "managed-applications": "b023390ce2ef1b8b76ab2c54866ea92d643efe64bab41428d6399a3fdb3ea48f",
    "azure-migrate": "9e0f5f1d0aad21cc328d5fa09efa67d1fa43282c890ed07532404aab388c2325",
    "scheduler": "a20e1d385fd95f78a4db8074c79f7ebf183e320b00c02f1f3d4ce910b3be5a1f",
    "azure-lighthouse": "22031b52d88aefaaf600993806bad4b2d89cd00e8890124c48e6f59c3173dfb4",
    "resource-mover": "55e21866ca1793c6c2ddd7f518343fe0bbe398daf12efa18e28d67542ffcbefa",
    "update-management-center": "f998246cf29422d22f934bb139a1185365c5bba65dc90525f33d1e980354fa5b",
    "media-services": "11ec059a20aed36d20a12ea6a4de866bbbed1adeba7e26e244392ffb5e4cf44f",
    "aks-hci": "5b7e78aa82728145889e6e8134f19cec8e77f60b26e819b2ca5148adbb974b34",
    "azure-arc": "0eddbe6bed28fc93f49ddeac89ce467e18ceb462cab6cd14d1ec830ff5d13e15"
}; // CATALOG_HASHES
  const clone = value => JSON.parse(JSON.stringify(value));
  const token = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  const plain = value => value && typeof value === "object" && !Array.isArray(value);
  class BridgeError extends Error {
    constructor(message, options = {}) {super(message); Object.assign(this, {retryable: false}, options);}
  }
  const assert = (condition, message) => { if (!condition) throw new BridgeError(message); };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const stable = value => value === null || typeof value !== "object" ? JSON.stringify(value) :
    Array.isArray(value) ? "[" + value.map(stable).join(",") + "]" :
      "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}";
  async function hash(value) {
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stable(value))))]
      .map(byte => byte.toString(16).padStart(2, "0")).join("");
  }
  function text(value, field) {
    assert(typeof value === "string" && value.length > 0 && value.length <= 220 &&
      !/[\x00-\x1f\x7f]/.test(value) && !/^[\s]*[=+\-@]/.test(value), "Invalid " + field);
  }
  function validateJob(job) {
    assert(plain(job) && ["calcbridge-job/v2", "calcbridge-job/v3"].includes(job.format), "Rebuild the CSV: this importer requires a single-estimate v2/v3 job.");
    const modern = job.format === "calcbridge-job/v3";
    assert(Object.keys(job).every(key => ["format", "run_id", "source_sha256", "currency", "pricing_context", "support", "templates", "loading", "estimate", ...(modern ? ["sources", "native_templates"] : [])].includes(key)), "Job contains unsupported settings");
    if (modern) {
      assert(Array.isArray(job.sources) && job.sources.length > 0 && plain(job.native_templates), "Missing source-file provenance or native templates");
      const files = new Set();
      for (const source of job.sources) {
        assert(plain(source) && Object.keys(source).every(key => ["file", "sha256", "bytes", "rows"].includes(key)) &&
          typeof source.file === "string" && source.file.length > 0 && source.file.length <= 120 && !/[\x00-\x1f\x7f]/.test(source.file) &&
          /^[a-f0-9]{64}$/.test(source.sha256) && Number.isSafeInteger(source.bytes) && source.bytes > 0 &&
          Number.isSafeInteger(source.rows) && source.rows > 0 && !files.has(source.file), "Invalid or duplicate source-file provenance");
        files.add(source.file);
      }
    }
    assert(typeof job.run_id === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,50}$/.test(job.run_id), "Invalid run ID");
    assert(job.pricing_context === "public" && job.support === "basic", "Only public prices with Basic support are verified.");
    assert(typeof job.currency === "string" && /^[A-Z]{3}$/.test(job.currency), "Invalid currency");
    assert(/^[a-f0-9]{64}$/.test(job.source_sha256), "Missing input hash");
    assert(plain(job.estimate) && plain(job.templates) && plain(job.loading), "Empty or malformed job");
    assert(Object.keys(job.estimate).every(key => ["name", "rows"].includes(key)), "Estimate contains unsupported settings");
    assert(Object.keys(job.loading).every(key => ["chunk_size", "max_attempts", "initial_backoff_ms", "max_backoff_ms"].includes(key)), "Loading configuration contains unsupported settings");
    const loading = job.loading;
    assert(Number.isInteger(loading.chunk_size) && loading.chunk_size >= 1 && loading.chunk_size <= 100 &&
      Number.isInteger(loading.max_attempts) && loading.max_attempts >= 1 && loading.max_attempts <= 5 &&
      Number.isInteger(loading.initial_backoff_ms) && loading.initial_backoff_ms >= 250 && loading.initial_backoff_ms <= 30000 &&
      Number.isInteger(loading.max_backoff_ms) && loading.max_backoff_ms >= loading.initial_backoff_ms && loading.max_backoff_ms <= 30000,
    "Invalid chunk size or retry settings");
    const batch = job.estimate;
    text(batch.name, "estimate name");
    assert(Array.isArray(batch.rows) && batch.rows.length > 0, "Estimate has no rows");
    const ids = new Set(), names = new Set(), sourceRows = new Set();
    for (const row of batch.rows) {
        const native = modern && row.format === "native";
        const allowed = ["source_row", "batch_id", "line_id", "service", "label", "region", "sku", "quantity", "pricing_option", "notes", "custom_name",
          ...(row.service === "virtual-machines" ? ["hours", "os", "os_type", "license"] : ["storage_size_gib", "redundancy"]), ...(modern ? ["source_file"] : [])];
        const nativeAllowed = ["format", "source_file", "source_row", "batch_id", "line_id", "service", "label", "notes", "configuration", "custom_name"];
        assert(Object.keys(row).every(key => (native ? nativeAllowed : allowed).includes(key)), "Row contains unsupported settings");
        if (modern) assert(job.sources.some(source => source.file === row.source_file), "Row has no matching source file");
        text(row.batch_id, "source batch ID");
        assert(typeof row.line_id === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$/.test(row.line_id), "Invalid line ID");
        const identity = (modern ? row.source_file + "\u0000" : "") + row.batch_id + "\u0000" + row.line_id;
        assert(!ids.has(identity), "Duplicate line ID within source group"); ids.add(identity);
        for (const field of (native ? ["label"] : ["label", "region", "sku"])) text(row[field], field);
        const filePrefix = modern && job.sources.length > 1 ? row.source_file + ":" : "";
        assert(row.custom_name === `[${filePrefix}${row.batch_id}/${row.line_id}] ${row.label}` && row.custom_name.length <= 220 && !names.has(row.custom_name), "Custom name lost source-line identity or is ambiguous");
        names.add(row.custom_name);
        assert(Number.isSafeInteger(row.source_row) && row.source_row >= 2, "Invalid source row");
        const sourceIdentity = (modern ? row.source_file + "\u0000" : "") + row.source_row;
        assert(!sourceRows.has(sourceIdentity), "Duplicate source row"); sourceRows.add(sourceIdentity);
        if (native) {validateNativeConfiguration(row, job.native_templates[row.service]); continue;}
        assert(Number.isSafeInteger(row.quantity) && row.quantity >= 1 && row.pricing_option === "payg", "Invalid quantity or pricing option");
        assert(Object.hasOwn(TEMPLATE_HASHES, row.service), "Unsupported service: " + row.service);
        if (row.service === "virtual-machines") {
          assert(Number.isFinite(row.hours) && row.hours >= 0 && row.hours <= 744, "Invalid monthly hours");
          assert((row.os === "linux" && row.os_type === "ubuntu" && row.license === "") ||
            (row.os === "windows" && row.os_type === "os-only" && row.license === "included"), "Unverified VM OS/licensing combination");
        } else {
          assert(/^P\d+$/i.test(row.sku) && row.redundancy === "lrs" &&
            Number.isSafeInteger(row.storage_size_gib) && row.storage_size_gib > 0, "Unverified disk configuration");
        }
    }
  }
  function validateNativeConfiguration(row, template) {
    assert(Object.hasOwn(NATIVE_TEMPLATE_HASHES, row.service) && plain(template) && template.service === row.service &&
      plain(template.configuration) && plain(row.configuration), "Unknown native service or missing configuration: " + row.service);
    assert(stable(Object.keys(row.configuration).sort()) === stable(Object.keys(template.configuration).sort()), "Native configuration fields differ from the pinned template");
    let nodes = 0;
    const safe = (value, depth = 0) => {
      assert(++nodes <= 20000 && depth <= 30, "Native configuration is too deeply nested or large");
      if (typeof value === "number") assert(Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER, "Invalid native number");
      else if (typeof value === "string") assert(value.length <= 10000, "Native string is too long");
      else if (value && typeof value === "object") for (const key of Object.keys(value)) {
        assert(!["__proto__", "prototype", "constructor"].includes(key), "Unsafe native configuration key"); safe(value[key], depth + 1);
      }
    };
    safe(row.configuration);
    for (const [key, value] of Object.entries(row.configuration)) {
      assert(!/price/i.test(key) && !key.endsWith("Total") && !["serviceSlug", "version", "displayName", "total", "upfrontTotal", "prices", "description", "isCollapsed", "isDeprecated", "isBreakingChange", "layoutId", "resourceId", "sku"].includes(key), "Output fields cannot be supplied as native inputs");
      const expected = template.configuration[key];
      assert(expected === null || (Array.isArray(expected) ? Array.isArray(value) :
        expected && typeof expected === "object" ? plain(value) : typeof value === typeof expected), "Native field type changed: " + key);
    }
  }
  function makeNativeModule(row, template) {
    validateNativeConfiguration(row, template);
    return Object.assign(clone(template.golden), clone(row.configuration),
      {displayName: row.custom_name, isCollapsed: true, total: 0, upfrontTotal: 0});
  }
  function isTransient(error) {
    if ([400, 401, 403, 404, 413].includes(error?.status) || error?.retryable === false) return false;
    if (error?.retryable === true) return true;
    return ["AbortError", "TimeoutError"].includes(error?.name) || /failed to fetch|network error|networkerror|load failed|\b(408|429|500|502|503|504)\b/i.test(String(error?.message || error));
  }
  function retryAfter(value, now = Date.now()) {
    if (!value) return 0;
    const seconds = Number(value);
    return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, (Date.parse(value) || now) - now);
  }
  async function withRetries(operation, settings, onRetry = () => {}, wait = sleep, random = Math.random) {
    for (let attempt = 1; attempt <= settings.max_attempts; attempt++) {
      try {return await operation(attempt);}
      catch (error) {
        if (isTransient(error) && error.retryAfterMs > 0) {
          const retryAt = Date.now() + error.retryAfterMs;
          runtime.retryNotBefore = Math.max(runtime.retryNotBefore || 0, retryAt);
          try {if (typeof localStorage !== "undefined") localStorage.setItem(CHECKPOINT_PREFIX + "retry-not-before", String(runtime.retryNotBefore));} catch {}
          if (attempt === settings.max_attempts) error.retryAt = retryAt;
        }
        if (!isTransient(error) || attempt === settings.max_attempts) throw error;
        const backoff = Math.min(settings.max_backoff_ms, settings.initial_backoff_ms * 2 ** (attempt - 1));
        const delay = Math.max(error.retryAfterMs || 0, Math.min(settings.max_backoff_ms, Math.round(backoff * (0.8 + random() * 0.4))));
        if (delay > 60000) {
          const retryAt = Date.now() + delay; runtime.retryNotBefore = retryAt;
          try {if (typeof localStorage !== "undefined") localStorage.setItem(CHECKPOINT_PREFIX + "retry-not-before", String(retryAt));} catch {}
          throw new BridgeError("The server requested a longer pause. Resume after " + new Date(retryAt).toISOString(), {retryable: false, retryAt});
        }
        onRetry({attempt, nextAttempt: attempt + 1, delay_ms: delay, message: String(error.message || error)});
        await wait(delay);
      }
    }
  }
  function regionFor(input, regions) {
    const candidates = regions.filter(region => token(region.slug) === token(input) || token(region.displayName) === token(input));
    const unique = [...new Set(candidates.map(region => region.slug))];
    assert(unique.length === 1, "Unknown or ambiguous region: " + input);
    return unique[0];
  }
  function sizeFor(input, sizes) {
    const wanted = token(input.replace(/^standard_/i, ""));
    const candidates = sizes.filter(size => token(size.slug) === wanted || token(size.displayName) === wanted);
    const unique = [...new Set(candidates.map(size => size.slug))];
    assert(unique.length === 1, "Unknown or ambiguous VM SKU: " + input);
    return unique[0];
  }
  function signature(schema) {
    return Object.fromEntries(Object.keys(schema).sort().map(key => [key,
      schema[key] === null ? "null" : Array.isArray(schema[key]) ? "array" : typeof schema[key]]));
  }
  function sameSchema(template, schema) {
    assert(plain(schema) && schema.version === template.golden.version &&
      stable(signature(schema)) === stable(template.schema_signature),
    "Microsoft changed the " + template.service + " schema. Stop and revalidate the adapter.");
  }
  function makeModule(row, template, region, catalog) {
    const module = clone(template.golden);
    Object.assign(module, {region, displayName: row.custom_name, months: 1, total: 0, upfrontTotal: 0,
      isCollapsed: true, isBreakingChange: false, addSnapshot: false});
    if (row.service === "virtual-machines") {
      const size = sizeFor(row.sku, catalog.metadata.sizesPayGo);
      const offer = catalog.regional.offers?.[`${row.os}-${size}-standard`];
      const price = offer?.prices?.perhour?.[region]?.value;
      assert(offer && !offer.isHidden && Number.isFinite(price) && price > 0,
        `${row.sku} / ${row.os} is unavailable at PAYG in ${row.region}`);
      Object.assign(module, {operatingSystem: row.os, type: row.os_type, size, count: row.quantity,
        hours: row.hours, hoursFactor: 1, tier: "standard", category: "all", instanceSeries: "all",
        billingOption: "payg", computeBillingOption: "payg", computePaymentOption: "monthly",
        osBillingOption: "payg", softwareBillingOption: "payg", sqlSoftwareBillingOption: "payg",
        addHybridBenefit: false, managedDisks: 0, managedDisksTransactions: 0,
        snapshotStorage: 0, interRegionUnits: 0, internetEgressUnits: 0});
    } else {
      const diskType = row.sku.toLowerCase();
      const offer = catalog.disk.offers?.[`premiumssd-${diskType}-lrs`];
      assert(offer && offer.size === row.storage_size_gib &&
        Number.isFinite(offer.prices?.[region]?.value) && offer.prices[region].value > 0,
      `${row.sku}: capacity or region does not match a live Premium SSD LRS meter`);
      Object.assign(module, {tier: "premiumssd", managedDiskType: diskType, managedDisks: row.quantity,
        managedDiskRedundancy: "lrs", managedDiskBillingOption: "payg", managedDiskPaymentOption: "monthly",
        managedDisksTransactions: 0, addDiskBursting: false, addManagedDisksSharedDisks: false});
    }
    return module;
  }
  function connect() {
    assert(location.origin === "https://azure.microsoft.com" && /^\/en-us\/pricing\/calculator\/?$/.test(location.pathname),
      "Open https://azure.microsoft.com/en-us/pricing/calculator/ first.");
    assert(global.deploymentVersion === SITE_BUILD, "The calculator deployment changed. This adapter must be revalidated before use.");
    const root = document.getElementById("azure-calculator");
    assert(root, "Calculator is not loaded yet");
    const current = root._reactRootContainer?._internalRoot?.current;
    assert(current, "Calculator frontend changed: React root is unavailable");
    const stack = [current], visited = new Set();
    let store, actions;
    while (stack.length && visited.size < 100000 && !(store && actions)) {
      const node = stack.pop();
      if (!node || visited.has(node)) continue;
      visited.add(node);
      const props = node.memoizedProps;
      if (props?.store?.getState && props.store.dispatch) store = props.store;
      if (props?.appActions?.openSavedOrSharedEstimate && props.appActions.addCalculatorModules) actions = props.appActions;
      if (node.sibling) stack.push(node.sibling);
      if (node.child) stack.push(node.child);
    }
    assert(store && actions && store.getState().app, "Calculator frontend actions changed; no state was imported");
    return {store, actions};
  }
  async function fetchJSON(path, settings) {
    return withRetries(async () => {
    const response = await fetch(new URL(path, location.origin), {credentials: "omit", headers: {Accept: "application/json"}, signal: AbortSignal.timeout(25000)});
    if (!response.ok) throw new BridgeError("Calculator catalog request failed: HTTP " + response.status,
      {status: response.status, retryable: [408, 429, 500, 502, 503, 504].includes(response.status), retryAfterMs: retryAfter(response.headers.get("Retry-After"))});
    assert((response.headers.get("content-type") || "").includes("json"), "Calculator returned a login page or non-JSON response");
    return response.json();
    }, settings, event => retryNotice("Catalog", event));
  }
  async function preflight(job) {
    validateJob(job);
    let retryNotBefore = runtime.retryNotBefore || 0;
    try {retryNotBefore = Math.max(retryNotBefore, Number(localStorage.getItem(CHECKPOINT_PREFIX + "retry-not-before")) || 0);} catch {}
    if (retryNotBefore > Date.now()) throw new BridgeError("Honor the server's pause; resume after " + new Date(retryNotBefore).toISOString(),
      {retryable: false, retryAt: retryNotBefore});
    const connection = connect();
    assert(global.pricing?.currencyData?.[job.currency.toLowerCase()], "Currency is not offered by this calculator: " + job.currency);
    const services = [...new Set(job.estimate.rows.filter(row => row.format !== "native").map(row => row.service))];
    for (const service of services) {
      assert(plain(job.templates[service]) && await hash(job.templates[service]) === TEMPLATE_HASHES[service],
        "Missing or modified verified template for " + service);
    }
    for (const service of new Set(job.estimate.rows.filter(row => row.format === "native").map(row => row.service))) {
      assert(plain(job.native_templates[service]) && await hash(job.native_templates[service]) === NATIVE_TEMPLATE_HASHES[service],
        "Missing or modified pinned native template for " + service);
      assert(job.native_templates[service].pricing_evidence !== "unavailable",
        service + ": the native product picker returned no usable price for this pinned service; revalidation is required before import");
      assert(connection.store.getState().app.data.products.some(product => product.slug === service), "Service is no longer offered by this calculator: " + service);
    }
    const cache = new Map();
    const readJSON = path => {if (!cache.has(path)) cache.set(path, fetchJSON(path, job.loading)); return cache.get(path);};
    // The page already fetched its region list during normal initialization.
    // Reuse that observed public metadata instead of issuing a duplicate read.
    const pageRegions = connection.store.getState().app.data.geos;
    const regionGroups = Array.isArray(pageRegions) && pageRegions.every(group => Array.isArray(group.regions)) ?
      pageRegions : await readJSON("/api/v2/pricing/calculator/regions/?culture=en-us");
    const regions = regionGroups.flatMap(group => group.regions);
    const metadata = services.includes("virtual-machines") ? await readJSON("/api/v4/pricing/virtual-machines/metadata/?discount=mca") : null;
    const disk = services.includes("managed-disks") ? await readJSON("/api/v2/pricing/managed-disks/calculator/?culture=en-us&discount=mca") : null;
    if (metadata) sameSchema(job.templates["virtual-machines"], metadata.schema);
    if (disk) sameSchema(job.templates["managed-disks"], disk.schema);
    const regional = new Map();
    // Every selected source row passes catalog checks before any UI mutation.
    const batch = job.estimate;
      const instances = [];
      for (const row of batch.rows) {
        try {
          if (row.format === "native") {
            const template = job.native_templates[row.service];
            let primary;
            for (const endpoint of template.endpoints) {
              const data = await readJSON(nativeEndpoint(endpoint, row.configuration.region));
              if (data.schema?.serviceSlug === row.service) primary = data;
            }
            assert(primary, "Native primary schema was not returned for " + row.service);
            sameSchema(template, primary.schema);
            const region = row.configuration.region;
            if (region && Array.isArray(primary.regions) && primary.regions.length && primary.regions.every(item => typeof item.slug === "string"))
              assert(primary.regions.some(item => item.slug === region), "Native region is unavailable for " + row.service + ": " + region);
            instances.push(makeNativeModule(row, template));
            continue;
          }
          const region = regionFor(row.region, regions);
          if (row.service === "virtual-machines" && !regional.has(region)) {
            const data = await readJSON(`/api/v4/pricing/virtual-machines/calculator/${encodeURIComponent(region)}/?culture=en-us&discount=mca`);
            sameSchema(job.templates["virtual-machines"], data.schema);
            regional.set(region, data);
          }
          instances.push(makeModule(row, job.templates[row.service], region, {metadata, disk, regional: regional.get(region)}));
        } catch (error) {
          throw new BridgeError(`${row.source_file || "CSV"} row ${row.source_row} (${row.line_id}): ${error.message}`,
            {retryable: false, retryAt: error.retryAt, status: error.status});
        }
      }
    return {connection, item: {batch, instances, nativeTemplates: job.native_templates || {}}};
  }
  function nativeEndpoint(endpoint, region) {
    assert(["v2", "v3", "v4"].includes(endpoint.version) && /^[a-z0-9\\-]+$/.test(endpoint.slug), "Invalid catalog endpoint");
    const regional = endpoint.version === "v4" ? (region || endpoint.region) : null;
    assert(!regional || /^[a-z0-9-]+$/.test(regional), "Invalid native region slug");
    return `/api/${endpoint.version}/pricing/${endpoint.slug.replace(/\\/g, "/")}/calculator/${regional ? regional + "/" : ""}?culture=en-us&discount=mca`;
  }
  const EXPECTED_VM = ["serviceSlug", "version", "region", "displayName", "months", "operatingSystem", "type", "size", "count", "hours", "hoursFactor", "tier", "category", "instanceSeries", "billingOption", "computeBillingOption", "computePaymentOption", "osBillingOption", "softwareBillingOption", "sqlSoftwareBillingOption", "addHybridBenefit", "managedDisks", "managedDisksTransactions", "snapshotStorage", "addSnapshot", "interRegionUnits", "internetEgressUnits"];
  const EXPECTED_DISK = ["serviceSlug", "version", "region", "displayName", "months", "tier", "managedDiskType", "managedDisks", "managedDiskRedundancy", "managedDiskBillingOption", "managedDiskPaymentOption", "managedDisksTransactions", "addDiskBursting", "addManagedDisksSharedDisks", "addSnapshot"];
  function verifyEstimate(app, item, currency, pricing = true) {
    const estimate = app.estimates[app.activeEstimateId];
    assert(estimate && estimate.estimateName === item.batch.name, "Expected estimate is not active");
    if (pricing && (app.isReloadingApis || app.isModuleListLoading)) throw new BridgeError("Calculator is still loading", {retryable: true});
    if (pricing) assert(!app.hasErrorOccurred, "Calculator reported an error; inspect the estimate before resuming");
    assert(estimate.modules.length === item.instances.length, "Calculator resource count differs from CSV");
    assert(estimate.currentCurrency.value === currency && !estimate.currentCurrency.locked, "Calculator currency differs from request");
    assert(estimate.discounts.base === "mca" && estimate.discounts.additional.length === 0 &&
      !estimate.enrollment && !estimate.microsoftCustomerAgreementAccount?.id && !estimate.microsoftCustomerAgreementProfile?.id &&
      !estimate.microsoftCustomerAgreementTenant && estimate.supportLevel === "free" && estimate.markupPercentage === 0,
    "Calculator pricing context differs from public rates / Basic support");
    if (pricing && !(Number.isFinite(estimate.estimatePrice) && estimate.estimatePrice >= 0 && Number.isFinite(estimate.estimateUpfrontPrice) && estimate.estimateUpfrontPrice >= 0))
      throw new BridgeError("Calculator totals are not ready", {retryable: true});
    const seen = new Set();
    return estimate.modules.map((entry, i) => {
      const expected = item.instances[i], actual = entry.currentModuleState, row = item.batch.rows[i];
      const native = row.format === "native";
      const fields = native ? ["serviceSlug", "version", "displayName", ...Object.keys(row.configuration)] : row.service === "virtual-machines" ? EXPECTED_VM : EXPECTED_DISK;
      for (const field of fields) assert(stable(actual[field]) === stable(expected[field]), `${row.source_file || "CSV"}:${row.source_row} ${row.line_id}: calculator changed ${field}`);
      assert(!actual.isDeprecated, `${row.service}: calculator marks this configuration deprecated`);
      assert(!/an error occurred|please refresh.*remove/i.test(actual.description || ""), `${row.service}: native calculator reports a pricing error`);
      assert(!seen.has(entry.index), "Calculator reused a module ID"); seen.add(entry.index);
      const template = item.nativeTemplates?.[row.service];
      const priceReady = native && template?.pricing_evidence === "native-free-service" ?
        actual.total === 0 && actual.upfrontTotal === 0 && actual.description === template.free_description :
        native && template?.pricing_evidence === "native-derived-total" ? typeof actual.description === "string" && actual.description.length > 0 :
        actual.prices && Number.isFinite(actual.prices.total) && Math.abs(actual.prices.total - actual.total) <= (native ? 1e-8 * Math.max(1, Math.abs(actual.total)) : 0);
      const derivedOutput = !native || actual.description || actual.layoutId ||
        (actual.prices && Object.keys(actual.prices).some(key => !["total", "upfrontTotal"].includes(key)));
      if (pricing && !(actual.hasPricing !== false && priceReady && derivedOutput &&
        Number.isFinite(actual.total) && actual.total >= 0 &&
        (native || row.hours === 0 || actual.total > 0) && Number.isFinite(actual.upfrontTotal) && actual.upfrontTotal >= 0 && (native || actual.upfrontTotal === 0)))
        throw new BridgeError(`${row.line_id}: calculator has not produced a fresh price`, {retryable: true});
      return {source_file: row.source_file, source_row: row.source_row, batch_id: row.batch_id, line_id: row.line_id, custom_name: row.custom_name,
        module_id: entry.index, region: actual.region, description: actual.description,
        configuration: Object.fromEntries(fields.map(field => [field, actual[field]])),
        calculator_base_monthly_usd: actual.total};
    });
  }
  async function waitForEstimate(store, item, currency) {
    let last, stableSince = 0;
    const until = Date.now() + Math.max(60000, Math.min(180000, item.instances.length * 1000));
    while (Date.now() < until) {
      try {
        const app = store.getState().app;
        const rows = verifyEstimate(app, item, currency);
        const fingerprint = stable(rows);
        if (fingerprint !== last) {last = fingerprint; stableSince = Date.now();}
        if (Date.now() - stableSince > 600) return rows;
      } catch (error) {if (!isTransient(error)) throw error; last = undefined; stableSince = 0; if (Date.now() + 250 >= until) throw error;}
      await sleep(250);
    }
    throw new BridgeError("Calculator did not finish pricing in time. Resume to recheck the same estimate.", {retryable: true});
  }
  function status(message) {
    const element = typeof document !== "undefined" && document.getElementById("calcbridge-status");
    if (element) element.textContent = message;
  }
  async function configurationHash(job) {
    const {loading, ...configuration} = job;
    return hash(configuration); // Retry/chunk settings may change without changing the estimate's identity.
  }
  function prefix(item, count) {
    return {...item, batch: {...item.batch, rows: item.batch.rows.slice(0, count)}, instances: item.instances.slice(0, count)};
  }
  function saveCheckpoint(checkpoint) {
    try {localStorage.setItem(CHECKPOINT_PREFIX + checkpoint.configuration_sha256, JSON.stringify(checkpoint));}
    catch {throw new BridgeError("Cannot store the resume checkpoint in this browser. No further resources were added.");}
  }
  function readCheckpoint(digest, total) {
    let value;
    try {const text = localStorage.getItem(CHECKPOINT_PREFIX + digest); if (!text) return null; value = JSON.parse(text);}
    catch {throw new BridgeError("The tool's resume checkpoint is unreadable. Use a fresh run ID.");}
    assert(value.configuration_sha256 === digest && value.site_build === SITE_BUILD &&
      typeof value.estimate_id === "string" && Array.isArray(value.module_ids) && value.module_ids.length === total &&
      new Set(value.module_ids).size === total && value.module_ids.every(id => typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id)) &&
      Number.isInteger(value.committed_count) && value.committed_count >= 0 && value.committed_count <= total &&
      Number.isInteger(value.pending_until) && value.pending_until >= value.committed_count && value.pending_until <= total,
    "Resume checkpoint does not match this job. Use a fresh run ID; existing estimates will be retained.");
    return value;
  }
  function ownedEstimate(store, checkpoint, item, currency) {
    const app = store.getState().app;
    assert(app.activeEstimateId === checkpoint.estimate_id, "Switch back to the imported estimate before resuming. Another estimate is active.");
    const estimate = app.estimates[checkpoint.estimate_id];
    assert(estimate && estimate.estimateName === item.batch.name, "Imported estimate is missing or was renamed; no changes were made");
    const count = estimate.modules.length;
    assert(count === checkpoint.committed_count || count === checkpoint.pending_until,
      "Estimate contains unexpected added or missing resources. No automatic changes were made.");
    assert(estimate.modules.every((module, index) => module.index === checkpoint.module_ids[index]),
      "Imported resource IDs changed; automatic resume is unsafe");
    verifyEstimate(app, prefix(item, count), currency, false);
    return estimate;
  }
  function retryNotice(phase, event) {
    runtime.report?.retries.push({phase, ...event, utc: new Date().toISOString()});
    status(`${phase}: temporary failure. Attempt ${event.nextAttempt} in ${(event.delay_ms / 1000).toFixed(1)} seconds…`);
  }
  function requestQueue(limit = 2) {
    let active = 0, nextStart = 0;
    const waiting = [];
    return async operation => {
      if (active < limit) active++; else await new Promise(resolve => waiting.push(resolve));
      try {
        const start = Math.max(Date.now(), nextStart); nextStart = start + 150;
        if (start > Date.now()) await sleep(start - Date.now());
        return await operation();
      } finally {if (waiting.length) waiting.shift()(); else active--;}
    };
  }
  async function nativeLoad(connection, target, checkpoint, settings, counts) {
    // Native module loading performs GETs. Retry only those catalog reads, with
    // their original arguments, and leave account writes/authentication untouched.
    const originalFetch = global.fetch;
    const schedule = requestQueue(), pendingRequests = new Set();
    let terminalError;
    const wrapped = async (input, init) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, location.href);
      const method = String(init?.method || input?.method || "GET").toUpperCase();
      if (method !== "GET" || url.origin !== location.origin || !/^\/api\/v[234]\/pricing\//.test(url.pathname)) return originalFetch(input, init);
      try {
        const request = schedule(() => withRetries(async () => {
          if (terminalError) throw terminalError;
          assert(connection.store.getState().app.activeEstimateId === checkpoint.estimate_id, "The active estimate changed; import stopped");
          const count = (counts.get(url.href) || 0) + 1; counts.set(url.href, count);
          if (count > settings.max_attempts) throw new BridgeError("Catalog retry budget exhausted", {retryable: false});
          const response = await originalFetch(input, init);
          if (!response.ok) throw new BridgeError("Native catalog HTTP " + response.status, {status: response.status,
            retryable: [408, 429, 500, 502, 503, 504].includes(response.status), retryAfterMs: retryAfter(response.headers.get("Retry-After"))});
          return response;
        }, settings, event => retryNotice("Pricing catalog", event)));
        pendingRequests.add(request);
        try {return await request;} finally {pendingRequests.delete(request);}
      } catch (error) {terminalError = error; throw error;}
    };
    global.fetch = wrapped;
    try {await connection.actions.addCalculatorModules(target);}
    catch (error) {throw terminalError || (error instanceof Error ? error : new BridgeError(String(error || "Native module loading failed without diagnostics")));}
    finally {await Promise.allSettled([...pendingRequests]); if (global.fetch === wrapped) global.fetch = originalFetch;}
  }
  async function applyChunk(connection, item, job, checkpoint, targetCount) {
    const step = {estimate_id: checkpoint.estimate_id, from: checkpoint.committed_count, until: targetCount, attempts: 0, status: "loading"};
    runtime.report.steps.push(step);
    const readBudget = new Map();
    // Assign every ID before a load. Repeating an absolute prefix uses the same
    // IDs; a lost acknowledgement cannot append duplicate resources.
    checkpoint.pending_until = targetCount; saveCheckpoint(checkpoint);
    try {
      const rows = await withRetries(async attempt => {
        step.attempts = attempt;
        if (runtime.pauseRequested) throw new BridgeError("Paused before the next loading step", {code: "paused"});
        const estimate = ownedEstimate(connection.store, checkpoint, item, job.currency);
        if (estimate.modules.length === targetCount) {
          // A previous attempt can have committed even if its response was lost.
          // First recheck that exact state; never blindly append another copy.
          try {return await waitForEstimate(connection.store, prefix(item, targetCount), job.currency);}
          catch (error) {if (!isTransient(error)) throw error;}
        }
        const modules = item.instances.slice(0, targetCount).map((state, index) => index < estimate.modules.length ? estimate.modules[index] :
          {index: checkpoint.module_ids[index], serviceSlug: state.serviceSlug, currentModuleState: clone(state)});
        await nativeLoad(connection, {...estimate, modules}, checkpoint, job.loading, readBudget);
        ownedEstimate(connection.store, checkpoint, item, job.currency);
        return waitForEstimate(connection.store, prefix(item, targetCount), job.currency);
      }, job.loading, event => retryNotice("Loading step", event));
      checkpoint.committed_count = targetCount; checkpoint.pending_until = targetCount; saveCheckpoint(checkpoint);
      step.status = "website-validated"; step.finished_utc = new Date().toISOString();
      runtime.report.loaded_rows = targetCount; runtime.report.estimate.rows = rows;
      runtime.report.estimate.calculator_base_monthly_usd = connection.store.getState().app.estimates[checkpoint.estimate_id].estimatePrice;
      return rows;
    } catch (error) {step.status = error.code === "paused" ? "paused" : "failed"; step.error = String(error.message || error); throw error;}
  }
  async function importJob(job) {
    assert(!runtime.busy, "Another import is already running"); validateJob(job);
    runtime.busy = true; runtime.pauseRequested = false; runtime.job = job;
    runtime.report = {format: "calcbridge-browser-report/v2", run_id: job.run_id, source_sha256: job.source_sha256,
      job_format: job.format, sources: job.sources ? clone(job.sources) : undefined,
      site_build: SITE_BUILD, currency: job.currency, pricing_context: "public", started_utc: new Date().toISOString(),
      verification_status: "not-tested", requested_rows: job.estimate.rows.length, loaded_rows: 0,
      steps: [], retries: [], estimate: {name: job.estimate.name, rows: [], official_export: "not-requested"}};
    try {
      status("Checking every resource against the live calculator catalog…");
      const {connection, item} = await preflight(job); runtime.item = item;
      const digest = await configurationHash(job); runtime.report.configuration_sha256 = digest;
      let checkpoint = readCheckpoint(digest, item.instances.length);
      if (checkpoint) ownedEstimate(connection.store, checkpoint, item, job.currency);
      else {
        const estimates = connection.store.getState().app.estimates;
        assert(!Object.values(estimates).some(estimate => estimate.estimateName === item.batch.name),
          "An estimate with this name already exists without a matching tool checkpoint. Use a fresh run ID; it will not be overwritten.");
        assert(Object.keys(estimates).length < OPEN_ESTIMATE_TABS, "Close an unused calculator estimate tab yourself before creating this one.");
      }
      const action = checkpoint ? "Resume" : "Create new estimate";
      if (!confirm(`${action} "${item.batch.name}"?\n\nAll ${item.instances.length} resources will be in ONE estimate.\nLoading steps: up to ${job.loading.chunk_size} items each.\n${job.currency}; public catalog prices; Basic support.\nReview operator-summary.txt before continuing. Existing unrelated estimates will be retained.`)) {
        runtime.report.verification_status = "cancelled"; status("Import cancelled before any loading step."); return clone(runtime.report);
      }
      if (!checkpoint) {
        const before = new Set(Object.keys(connection.store.getState().app.estimates));
        let creationError;
        try {await connection.actions.openSavedOrSharedEstimate({name: item.batch.name, instances: [], currency: job.currency,
          isCurrentCurrencyLocked: false, priceLevelId: "mca", additionalDiscounts: [], markupValue: 0, support: {level: "free", total: 0}});}
        catch (error) {creationError = error;}
        const created = Object.values(connection.store.getState().app.estimates).filter(estimate => !before.has(estimate.id) && estimate.estimateName === item.batch.name);
        assert(created.length === 1 && created[0].modules.length === 0,
          "Could not identify one newly created empty estimate. Inspect the calculator before retrying. " + (creationError?.message || ""));
        checkpoint = {configuration_sha256: digest, site_build: SITE_BUILD, estimate_id: created[0].id,
          module_ids: item.instances.map(() => crypto.randomUUID()), committed_count: 0, pending_until: 0};
        saveCheckpoint(checkpoint);
      }
      runtime.report.estimate.estimate_id = checkpoint.estimate_id;
      runtime.report.loaded_rows = checkpoint.committed_count;
      // Recover an acknowledged or unacknowledged pending prefix first.
      if (checkpoint.pending_until > checkpoint.committed_count)
        await applyChunk(connection, item, job, checkpoint, checkpoint.pending_until);
      while (checkpoint.committed_count < item.instances.length) {
        if (runtime.pauseRequested) throw new BridgeError("Paused after the completed loading step", {code: "paused"});
        const target = Math.min(item.instances.length, checkpoint.committed_count + job.loading.chunk_size);
        status(`Loading ${target}/${item.instances.length} resources into the same estimate…`);
        await applyChunk(connection, item, job, checkpoint, target);
        await sleep(200); // Give the page a chance to paint progress and accept Pause.
      }
      const rows = await waitForEstimate(connection.store, item, job.currency);
      runtime.report.estimate.rows = rows; runtime.report.loaded_rows = rows.length;
      runtime.report.estimate.calculator_base_monthly_usd = connection.store.getState().app.estimates[checkpoint.estimate_id].estimatePrice;
      runtime.report.verification_status = "website-validated"; runtime.report.validated_utc = new Date().toISOString();
      status(`All ${rows.length} resources are loaded and checked in one estimate. Review it, then export Excel.`);
      return clone(runtime.report);
    } catch (error) {
      runtime.report.verification_status = error.code === "paused" ? "paused" : "failed";
      runtime.report.error = String(error.message || error);
      if (error.retryAt) runtime.report.retry_not_before = new Date(error.retryAt).toISOString();
      status(`Import ${runtime.report.verification_status}: ${runtime.report.error} Resume uses this same estimate.`);
      if (error.code === "paused") return clone(runtime.report);
      console.error("CSV bridge:", runtime.report.error);
      throw error;
    } finally {runtime.busy = false;}
  }
  async function verifyCurrent(job) {
    assert(!runtime.busy, "Wait for the current import to finish"); runtime.busy = true;
    try {
      const {connection: {store}, item} = await preflight(job);
      const digest = await configurationHash(job), checkpoint = readCheckpoint(digest, item.instances.length);
      assert(checkpoint, "No tool checkpoint is available for this job in this browser profile");
      ownedEstimate(store, checkpoint, item, job.currency);
      const rows = await waitForEstimate(store, item, job.currency), estimate = store.getState().app.estimates[checkpoint.estimate_id];
      checkpoint.committed_count = rows.length; checkpoint.pending_until = rows.length; saveCheckpoint(checkpoint);
      runtime.job = job; runtime.item = item;
      runtime.report = {format: "calcbridge-browser-report/v2", source_sha256: job.source_sha256, configuration_sha256: digest,
        job_format: job.format, sources: job.sources ? clone(job.sources) : undefined,
        run_id: job.run_id, site_build: SITE_BUILD, currency: job.currency, requested_rows: rows.length, loaded_rows: rows.length,
        verification_status: "website-validated", validated_utc: new Date().toISOString(), steps: [], retries: [],
        estimate: {name: item.batch.name, estimate_id: estimate.id, calculator_base_monthly_usd: estimate.estimatePrice,
          official_export: "not-requested", rows}};
      status(`Rechecked all ${rows.length} items in this estimate. Ready for Excel export.`);
      return clone(runtime.report);
    } finally {runtime.busy = false;}
  }
  function compactExportPayload(payload) {
    const result = clone(payload);
    for (const instance of result.instances) {
      if (instance.serviceSlug === "virtual-machines" && instance.prices?.premiumssdV2Offer &&
        instance.managedDisks === 0 && instance.managedDiskTier === "standardhdd" && instance.addSnapshot === false && instance.snapshotStorage === 0) {
        // This unused offer contains large regional caches. Live cell-by-cell
        // comparisons proved it is unnecessary for the supported export path.
        // Keep all actual prices, native totals, descriptions and configuration.
        delete instance.prices.premiumssdV2Offer;
      }
    }
    return result;
  }
  async function captureNativeExport() {
    const button = document.querySelector('#azure-calculator [aria-label="Export Estimate"]');
    const form = document.querySelector('form[data-hidden-form="true"]');
    assert(button && !button.disabled && form?.action === location.origin + "/pricing/calculator/exportestimate/", "Native export control changed; stop and revalidate the adapter");
    const original = form.submit;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {form.submit = original; reject(new BridgeError("Native export data was not captured; check the calculator before retrying"));}, 10000);
      form.submit = function () {
        try {
          assert(this === form && this.elements.estimate.value, "Native export did not produce estimate data");
          resolve({payload: JSON.parse(this.elements.estimate.value), currency: this.elements.currency.value, endpoint: this.action});
        } catch (error) {reject(error);}
        finally {clearTimeout(timer); form.submit = original;}
        // The same native request is sent below after compacting only its unused cache.
      };
      try {button.click();} catch (error) {clearTimeout(timer); form.submit = original; reject(error);}
    });
  }
  async function exportCurrent() {
    assert(!runtime.busy && runtime.job && runtime.report && runtime.report.verification_status === "website-validated",
      "Finish or recheck the complete import before exporting");
    runtime.busy = true;
    try {
      const {store} = connect(), app = store.getState().app, estimate = app.estimates[app.activeEstimateId];
      verifyEstimate(app, runtime.item, runtime.job.currency);
      assert(estimate.id === runtime.report.estimate.estimate_id, "Another estimate is active");
      status("Preparing one Microsoft Excel export for all resources…");
      const capture = await captureNativeExport();
      assert(capture.currency === runtime.job.currency && capture.payload.instances.length === runtime.item.instances.length &&
        capture.payload.name === estimate.estimateName && capture.payload.total === estimate.estimatePrice &&
        capture.payload.instances.every((value, index) => {
          const actual = estimate.modules[index].currentModuleState;
          return value.serviceSlug === actual.serviceSlug && value.displayName === actual.displayName && value.region === actual.region &&
            value.total === actual.total && value.description === actual.description;
        }), "Native export identity or totals differ from the loaded estimate");
      const payload = compactExportPayload(capture.payload);
      const body = new URLSearchParams({estimate: JSON.stringify(payload), currency: capture.currency}).toString();
      const blob = await withRetries(async () => {
        const response = await fetch(capture.endpoint, {method: "POST", credentials: "same-origin",
          headers: {Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Content-Type": "application/x-www-form-urlencoded"},
          body, signal: AbortSignal.timeout(60000)});
        if (response.status !== 200) throw new BridgeError("Microsoft export HTTP " + response.status + (response.status === 413 ? ": request remains too large; no workbook was produced" : ""),
          {status: response.status, retryable: [408, 429, 500, 502, 503, 504].includes(response.status), retryAfterMs: retryAfter(response.headers.get("Retry-After"))});
        const file = await response.blob(), magic = new Uint8Array(await file.slice(0, 4).arrayBuffer());
        assert(file.size > 100 && magic[0] === 0x50 && magic[1] === 0x4b && magic[2] === 3 && magic[3] === 4,
          "Microsoft export did not return an XLSX/ZIP file; nothing was downloaded");
        return file;
      }, runtime.job.loading, event => retryNotice("Excel export", event));
      // Reject an intervening edit or switched estimate before issuing the download.
      verifyEstimate(store.getState().app, runtime.item, runtime.job.currency);
      assert(store.getState().app.activeEstimateId === estimate.id, "Active estimate changed during export");
      assert(store.getState().app.estimates[estimate.id].estimatePrice === capture.payload.total &&
        store.getState().app.estimates[estimate.id].modules.every((module, index) => module.currentModuleState.total === capture.payload.instances[index].total),
      "Calculator prices changed during export; recheck and export again");
      const data = await blob.arrayBuffer();
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))].map(byte => byte.toString(16).padStart(2, "0")).join("");
      const filename = estimate.estimateName.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") + ".xlsx";
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      runtime.report.estimate.official_export = "server-file-received-download-requested";
      runtime.report.estimate.export = {filename, sha256: digest, bytes: blob.size, received_utc: new Date().toISOString(),
        request_bytes: new TextEncoder().encode(body).length, original_json_bytes: new TextEncoder().encode(JSON.stringify(capture.payload)).length,
        compact_json_bytes: new TextEncoder().encode(JSON.stringify(payload)).length};
      status(`Microsoft generated one workbook for all ${runtime.item.instances.length} items. Check the download and keep it untouched.`);
      return clone(runtime.report.estimate.export);
    } catch (error) {
      if (runtime.report) {runtime.report.estimate.official_export = "failed"; runtime.report.estimate.export_error = String(error.message || error);}
      status("Excel export failed: " + String(error.message || error)); throw error;
    } finally {runtime.busy = false;}
  }
  function downloadReport() {
    assert(runtime.report, "No import report is available yet");
    const url = URL.createObjectURL(new Blob([JSON.stringify(runtime.report, null, 2) + "\n"], {type: "application/json"}));
    const link = document.createElement("a"); link.href = url; link.download = "calcbridge-import-report.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function pick(verify = false) {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async () => { try {if (input.files[0]) {const job = JSON.parse(await input.files[0].text()); await (verify ? verifyCurrent(job) : importJob(job));}} catch (error) {status(error.message);} };
    input.click();
  }
  function resume() {return runtime.job ? importJob(runtime.job) : pick();}
  function pause() {runtime.pauseRequested = true; status("Pause requested. The current loading step will finish; Resume will continue this same estimate.");}
  function install() {
    connect();
    document.getElementById("calcbridge-panel")?.remove();
    const panel = document.createElement("section"); panel.id = "calcbridge-panel";
    panel.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:420px;padding:16px;border:1px solid #8ab4f8;border-radius:8px;background:#fff;color:#172033;box-shadow:0 3px 18px #0003;font:14px system-ui";
    const title = document.createElement("strong"); title.textContent = "Azure CSV Import"; panel.append(title);
    const message = document.createElement("p"); message.id = "calcbridge-status"; message.textContent = "Choose a CSV job. All its resources will load into one estimate."; panel.append(message);
    for (const [label, action] of [["Choose import job", () => pick()], ["Resume", resume], ["Pause after this step", pause], ["Check reopened estimate", () => pick(true)], ["Export Excel", exportCurrent], ["Download import report", downloadReport]]) {
      const button = document.createElement("button"); button.textContent = label; button.type = "button";
      button.style.cssText = "margin:3px;padding:7px;cursor:pointer";
      button.onclick = () => Promise.resolve().then(action).catch(error => status(error.message)); panel.append(button);
    }
    document.body.append(panel);
  }
  const api = {install, pick, importJob, resume, pause, verifyCurrent, exportCurrent, downloadReport,
    getReport: () => runtime.report ? clone(runtime.report) : null};
  global.AzureCalcBridge = api;
  if (typeof module !== "undefined" && module.exports) module.exports = {validateJob, regionFor, sizeFor, signature, sameSchema, makeModule, stable,
    compactExportPayload, retryAfter, isTransient, withRetries, BridgeError, prefix, verifyEstimate, ownedEstimate,
    validateNativeConfiguration, makeNativeModule, nativeEndpoint, requestQueue};
  if (typeof document !== "undefined") {
    try {install();} catch (error) {console.error("CSV bridge:", error.message);}
  }
})(globalThis);
