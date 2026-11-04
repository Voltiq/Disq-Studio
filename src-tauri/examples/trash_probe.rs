//! Checks what `trash::delete` does with an item Windows can't recycle.
//! Usage: cargo run --example trash_probe -- <path>
//! Prints the result and whether the item still exists afterwards.

fn main() {
    let path = std::env::args().nth(1).expect("pass a path");
    let started = std::time::Instant::now();
    let result = trash::delete(&path);
    println!("result: {result:?}");
    println!("still exists: {}", std::path::Path::new(&path).exists());
    println!("took: {:?}", started.elapsed());
}
