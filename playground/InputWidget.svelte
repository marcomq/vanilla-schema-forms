<script>
  let { elementId, node, value, name } = $props();
</script>

<div class="mb-3">
  <label for={elementId} class="form-label">
    {node.title}
  </label>
  <input 
    type="text" 
    class="form-control" 
    id={elementId} 
    name={name} 
    bind:value={value} 
  />
</div>
