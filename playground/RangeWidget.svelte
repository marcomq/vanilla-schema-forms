<script>
  export let elementId;
  export let node;
  export let value;
  export let name;
</script>

<div class="mb-3 p-3 border rounded bg-light">
  <label for={elementId} class="form-label fw-bold text-primary">
    {node.title}: <span class="badge bg-secondary">{value}</span>
  </label>
  <input 
    type="range" 
    class="form-range" 
    id={elementId} 
    name={name} 
    min={node.minimum || 0} 
    max={node.maximum || 10} 
    bind:value={value} 
  />
</div>
